"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  confirmRdoAction,
  deleteRdoPhotoAction,
  reopenRdoAction,
  saveRdoAction,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/format";
import { calcularSaldo } from "@/lib/rdo/saldo";
import {
  emptyRdoPayload,
  rdoPayloadSchema,
  type RdoPayload,
  type RdoPayloadForm,
} from "@/lib/rdo/schema";

export type RdoService = {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  executada: number;
};

export type RdoPhoto = {
  id: string;
  storage_path: string;
  legenda: string | null;
  url: string;
};

type Props = {
  workId: string;
  workName: string;
  date: string;
  initialRdoId: string | null;
  initialPayload?: RdoPayloadForm;
  initialPhotos: RdoPhoto[];
  services: RdoService[];
  canEdit: boolean;
  canConfirm: boolean;
  confirmed: boolean;
};

const climaOptions = [
  ["bom", "Bom"],
  ["nublado", "Nublado"],
  ["chuva_fraca", "Chuva fraca"],
  ["chuva_forte", "Chuva forte"],
  ["impraticavel", "Impraticável"],
] as const;

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-6";
const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50";

export function RdoEditor({
  workId,
  workName,
  date,
  initialRdoId,
  initialPayload,
  initialPhotos,
  services,
  canEdit,
  canConfirm,
  confirmed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rdoId, setRdoId] = useState(initialRdoId);
  const [photos, setPhotos] = useState(initialPhotos);
  const [photoEapItemId, setPhotoEapItemId] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [serviceSearch, setServiceSearch] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const form = useForm<RdoPayloadForm, unknown, RdoPayload>({
    resolver: zodResolver(rdoPayloadSchema),
    defaultValues: initialPayload ?? emptyRdoPayload(),
  });
  const labor = useFieldArray({ control: form.control, name: "mao_obra" });
  const production = useFieldArray({ control: form.control, name: "producao" });
  const equipment = useFieldArray({ control: form.control, name: "equipamentos" });
  const materials = useFieldArray({ control: form.control, name: "materiais" });
  const occurrences = useFieldArray({ control: form.control, name: "ocorrencias" });
  const watchedProduction = useWatch({ control: form.control, name: "producao" });
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  const save = (payload: RdoPayload) => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await saveRdoAction({ obraId: workId, data: date, payload });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.rdoId) setRdoId(result.rdoId);
      setMessage(result.success ?? "Rascunho salvo.");
      router.refresh();
    });
  };

  const updateStatus = (action: typeof confirmRdoAction) => {
    if (!rdoId) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await action({ obraId: workId, rdoId });
      if (result.error) setError(result.error);
      else {
        setMessage(result.success ?? "Status atualizado.");
        router.refresh();
      }
    });
  };

  async function uploadPhoto(file: File) {
    setPhotoBusy(true);
    setError("");
    setMessage("");
    try {
      const currentValues = form.getValues();
      const validation = rdoPayloadSchema.safeParse(currentValues);
      if (!validation.success) {
        setError(validation.error.issues[0]?.message ?? "Corrija os campos antes de anexar uma foto.");
        return;
      }
      const saved = await saveRdoAction({ obraId: workId, data: date, payload: validation.data });
      if (saved.error || !saved.rdoId) {
        setError(saved.error ?? "Salve o rascunho antes de anexar a foto.");
        return;
      }
      setRdoId(saved.rdoId);

      const image = await createImageBitmap(file);
      const ratio = Math.min(1, 1920 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível processar a imagem.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const jpeg = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível converter a imagem.")), "image/jpeg", 0.8);
      });

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
      const path = `${workId}/${saved.rdoId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("obx_fotos").upload(path, jpeg, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: photo, error: insertError } = await supabase
        .from("obx_fotos")
        .insert({
          obra_id: workId,
          rdo_id: saved.rdoId,
          eap_item_id: photoEapItemId || null,
          storage_path: path,
          legenda: null,
          tirada_em: new Date().toISOString(),
          criado_por: user.id,
        })
        .select("id,storage_path,legenda")
        .single();
      if (insertError || !photo) {
        await supabase.storage.from("obx_fotos").remove([path]);
        throw insertError ?? new Error("Não foi possível registrar a foto.");
      }
      const { data: signed, error: signedError } = await supabase.storage
        .from("obx_fotos")
        .createSignedUrl(path, 3600);
      if (signedError || !signed) throw signedError ?? new Error("Não foi possível exibir a foto.");
      setPhotos((current) => [...current, { ...photo, url: signed.signedUrl }]);
      setMessage("Foto anexada ao RDO.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível anexar a foto.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photoId: string) {
    setError("");
    const result = await deleteRdoPhotoAction({ id: photoId });
    if (result.error) setError(result.error);
    else {
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      setMessage(result.success ?? "Foto excluída.");
    }
  }

  const registerNumber = (name: Parameters<typeof form.register>[0]) =>
    form.register(name as never, { setValueAs: (value: string) => value === "" ? 0 : Number(value) });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Diário de obra · {date}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{workName}</h1>
          <p className="mt-1 text-sm text-slate-500">{confirmed ? "RDO confirmado" : "Rascunho"}{!canEdit && confirmed ? " · somente leitura" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <button type="submit" form="rdo-form" disabled={pending || photoBusy} className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar rascunho"}</button>}
          {canConfirm && !confirmed && rdoId && <button type="button" disabled={pending} onClick={() => updateStatus(confirmRdoAction)} className="min-h-11 rounded-xl border border-emerald-800 px-4 text-sm font-semibold text-emerald-900 disabled:opacity-60">Confirmar RDO</button>}
          {canConfirm && confirmed && rdoId && <button type="button" disabled={pending} onClick={() => updateStatus(reopenRdoAction)} className="min-h-11 rounded-xl border border-amber-300 px-4 text-sm font-semibold text-amber-900 disabled:opacity-60">Reabrir</button>}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}

      <form
        id="rdo-form"
        onSubmit={form.handleSubmit(save, () => setError("Revise os campos preenchidos e tente novamente."))}
        className="space-y-4"
      >
        <fieldset disabled={!canEdit || pending} className="space-y-4 disabled:opacity-90">
          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Clima</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(["clima_manha", "clima_tarde"] as const).map((name) => (
                <label key={name} className="space-y-1.5 text-xs font-semibold text-slate-600">
                  {name === "clima_manha" ? "Manhã" : "Tarde"}
                  <select {...form.register(name, { setValueAs: (value: string) => value === "" ? null : value })} className={inputClass}>
                    <option value="">Selecione o clima</option>
                    {climaOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Mão de obra</summary>
            <div className="mt-4 space-y-3">
              {labor.fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto]">
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Função<input {...form.register(`mao_obra.${index}.funcao`)} className={inputClass} placeholder="Ex.: Pedreiro" /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Pessoas<input type="number" min="0" step="1" {...registerNumber(`mao_obra.${index}.quantidade`)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Horas<input type="number" min="0" step="0.5" {...registerNumber(`mao_obra.${index}.horas`)} className={inputClass} /></label>
                  <button type="button" onClick={() => labor.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>
                </div>
              ))}
              <button type="button" onClick={() => labor.append({ funcao: "", quantidade: 0, horas: 0 })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Adicionar função</button>
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Produção</summary>
            <div className="mt-4 space-y-3">
              {production.fields.map((field, index) => {
                const currentId = watchedProduction[index]?.eap_item_id;
                const selected = currentId ? serviceById.get(currentId) : undefined;
                const amount = Number(watchedProduction[index]?.quantidade ?? 0);
                const saldo = selected ? calcularSaldo(selected.quantidade, selected.executada) : 0;
                const listId = `eap-servicos-${field.id}`;
                return (
                  <div key={field.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                      <label className="space-y-1 text-xs font-semibold text-slate-500">Serviço da EAP
                        <input
                          list={listId}
                          value={serviceSearch[index] ?? (selected ? `${selected.codigo} — ${selected.descricao}` : "")}
                          onChange={(event) => {
                            const value = event.target.value;
                            setServiceSearch((current) => ({ ...current, [index]: value }));
                            const match = services.find((service) => `${service.codigo} — ${service.descricao}` === value);
                            form.setValue(`producao.${index}.eap_item_id`, match?.id ?? "", { shouldDirty: true, shouldValidate: true });
                          }}
                          className={inputClass}
                          placeholder="Pesquise código ou serviço"
                        />
                        <datalist id={listId}>{services.map((service) => <option key={service.id} value={`${service.codigo} — ${service.descricao}`} />)}</datalist>
                        <input type="hidden" {...form.register(`producao.${index}.eap_item_id`)} />
                      </label>
                      <label className="space-y-1 text-xs font-semibold text-slate-500">Quantidade {selected?.unidade ? `(${selected.unidade})` : ""}
                        <input type="number" min="0" step="0.01" {...registerNumber(`producao.${index}.quantidade`)} className={inputClass} />
                      </label>
                      <button type="button" onClick={() => production.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>
                    </div>
                    {selected && <p className="mt-2 text-xs text-slate-500">Saldo antes deste RDO: {formatNumber(saldo, "pt-BR")} {selected.unidade ?? ""}</p>}
                    {selected && amount > saldo && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">A quantidade informada ultrapassa o saldo em {formatNumber(amount - saldo, "pt-BR")} {selected.unidade ?? ""}. O lançamento não será bloqueado.</p>}
                  </div>
                );
              })}
              <button type="button" onClick={() => production.append({ eap_item_id: "", quantidade: 0, observacao: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Registrar produção</button>
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Equipamentos</summary>
            <div className="mt-4 space-y-3">
              {equipment.fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_minmax(0,1fr)_auto]">
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Equipamento<input {...form.register(`equipamentos.${index}.equipamento`)} className={inputClass} placeholder="Ex.: Betoneira" /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Trabalhadas<input type="number" min="0" step="0.5" {...registerNumber(`equipamentos.${index}.horas_trabalhadas`)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Paradas<input type="number" min="0" step="0.5" {...registerNumber(`equipamentos.${index}.horas_paradas`)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Motivo da parada<input {...form.register(`equipamentos.${index}.motivo_parada`)} className={inputClass} /></label>
                  <button type="button" onClick={() => equipment.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>
                </div>
              ))}
              <button type="button" onClick={() => equipment.append({ equipamento: "", horas_trabalhadas: 0, horas_paradas: 0, motivo_parada: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Adicionar equipamento</button>
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Materiais recebidos</summary>
            <div className="mt-4 space-y-3">
              {materials.fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_140px_120px_auto]">
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Material<input {...form.register(`materiais.${index}.material`)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Quantidade<input type="number" min="0" step="0.01" {...registerNumber(`materiais.${index}.quantidade`)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Unidade<input {...form.register(`materiais.${index}.unidade`)} className={inputClass} /></label>
                  <button type="button" onClick={() => materials.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>
                </div>
              ))}
              <button type="button" onClick={() => materials.append({ material: "", quantidade: 0, unidade: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Registrar material</button>
            </div>
          </details>

          <details open id="ocorrencias" className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Ocorrências</summary>
            <div className="mt-4 space-y-3">
              {occurrences.fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[150px_minmax(0,1fr)_110px_110px_auto]">
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Tipo<input {...form.register(`ocorrencias.${index}.tipo`)} className={inputClass} placeholder="Ex.: Segurança" /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Descrição<input {...form.register(`ocorrencias.${index}.descricao`)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Início<input type="time" {...form.register(`ocorrencias.${index}.hora_inicio`)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-500">Fim<input type="time" {...form.register(`ocorrencias.${index}.hora_fim`)} className={inputClass} /></label>
                  <button type="button" onClick={() => occurrences.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>
                </div>
              ))}
              <button type="button" onClick={() => occurrences.append({ tipo: "", descricao: "", hora_inicio: "", hora_fim: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Adicionar ocorrência</button>
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Observações</summary>
            <textarea {...form.register("observacoes")} rows={4} className={`${inputClass} mt-4 py-3`} placeholder="Registre informações relevantes sobre o dia." />
          </details>
        </fieldset>
      </form>

      <section id="fotos" className={sectionClass}>
        <h2 className="text-base font-bold text-slate-900">Fotos</h2>
        <p className="mt-1 text-xs text-slate-500">As imagens são reduzidas para JPEG antes do envio. Máximo de 1920 px.</p>
        {canEdit && !confirmed && (
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-1 text-xs font-semibold text-slate-500">Associar a serviço (opcional)
              <select value={photoEapItemId} onChange={(event) => setPhotoEapItemId(event.target.value)} className={inputClass} disabled={photoBusy}>
                <option value="">Sem serviço associado</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.codigo} — {service.descricao}</option>)}
              </select>
            </label>
            <label className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 ${photoBusy ? "opacity-60" : ""}`}>
              {photoBusy ? "Enviando foto…" : "Tirar ou escolher foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={photoBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadPhoto(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        )}
        {photos.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <article key={photo.id} className="overflow-hidden rounded-xl border border-slate-200">
                <Image src={photo.url} alt={photo.legenda ?? "Foto do diário de obra"} width={480} height={360} unoptimized className="aspect-[4/3] w-full object-cover" />
                {canEdit && !confirmed && <button type="button" onClick={() => void removePhoto(photo.id)} className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-700">Excluir foto</button>}
              </article>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">Nenhuma foto anexada.</p>}
      </section>
    </div>
  );
}
