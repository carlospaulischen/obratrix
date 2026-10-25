"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  confirmRdoAction,
  deleteRdoPhotoAction,
  reopenRdoAction,
  saveRdoAction,
  type RdoVozDados,
} from "@/app/actions";
import { RdoVozPanel } from "@/components/rdo/rdo-voz-panel";
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

function InlineFieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={id} role="alert" className="block text-xs font-semibold text-rose-700">{message}</span> : null;
}

function fieldErrorId(name: string) {
  return `rdo-error-${name.replaceAll(".", "-")}`;
}

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const serviceListPrefix = useId().replaceAll(":", "");
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
  const fieldError = (name: FieldPath<RdoPayloadForm>) =>
    form.getFieldState(name, form.formState).error?.message;
  const errorClass = (message?: string) =>
    message ? "border-rose-500 focus:border-rose-600 focus:ring-rose-100" : "";
  const focusFirstError = () => {
    requestAnimationFrame(() => {
      const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!firstInvalid) return;
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus({ preventScroll: true });
    });
  };

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
      if (!(await form.trigger())) {
        setError("Corrija os campos destacados antes de anexar a foto.");
        focusFirstError();
        return;
      }
      const currentValues = form.getValues();
      const validation = rdoPayloadSchema.safeParse(currentValues);
      if (!validation.success) {
        setError(validation.error.issues[0]?.message ?? "Corrija os campos destacados antes de anexar a foto.");
        focusFirstError();
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
  const observationsError = fieldError("observacoes");

  const aplicarVoz = (dados: RdoVozDados) => {
    const marcadores = { shouldDirty: true, shouldValidate: true } as const;
    if (dados.clima_manha) form.setValue("clima_manha", dados.clima_manha as never, marcadores);
    if (dados.clima_tarde) form.setValue("clima_tarde", dados.clima_tarde as never, marcadores);
    if (dados.mao_obra.length) labor.replace(dados.mao_obra);
    if (dados.producao.length) production.replace(dados.producao);
    if (dados.equipamentos.length) equipment.replace(dados.equipamentos);
    if (dados.materiais.length) materials.replace(dados.materiais);
    if (dados.ocorrencias.length) occurrences.replace(dados.ocorrencias);
    if (dados.observacoes) {
      const atual = form.getValues("observacoes") ?? "";
      form.setValue("observacoes", atual ? `${atual}\n${dados.observacoes}` : dados.observacoes, marcadores);
    }
    setMessage("Relato estruturado pela IA — revise e salve.");
  };

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
        onSubmit={form.handleSubmit(save, () => {
          setError("Corrija os campos destacados antes de salvar.");
          focusFirstError();
        })}
        className="space-y-4"
      >
        <fieldset disabled={!canEdit || pending || photoBusy} className="space-y-4 disabled:opacity-90">
          {canEdit && !confirmed && <RdoVozPanel workId={workId} onAplicar={aplicarVoz} />}
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
              {labor.fields.map((field, index) => {
                const quantityPath = `mao_obra.${index}.quantidade` as const;
                const hoursPath = `mao_obra.${index}.horas` as const;
                const quantityError = fieldError(quantityPath);
                const hoursError = fieldError(hoursPath);
                return (
                  <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto]">
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Função<input {...form.register(`mao_obra.${index}.funcao`)} className={inputClass} placeholder="Ex.: Pedreiro" /></label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Pessoas
                      <input type="number" min="0" step="1" {...registerNumber(quantityPath)} className={`${inputClass} ${errorClass(quantityError)}`} aria-invalid={quantityError ? true : undefined} aria-describedby={quantityError ? fieldErrorId(quantityPath) : undefined} />
                      <InlineFieldError id={fieldErrorId(quantityPath)} message={quantityError} />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Horas
                      <input type="number" min="0" step="0.5" {...registerNumber(hoursPath)} className={`${inputClass} ${errorClass(hoursError)}`} aria-invalid={hoursError ? true : undefined} aria-describedby={hoursError ? fieldErrorId(hoursPath) : undefined} />
                      <InlineFieldError id={fieldErrorId(hoursPath)} message={hoursError} />
                    </label>
                    {canEdit && <button type="button" onClick={() => labor.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>}
                  </div>
                );
              })}
              {canEdit && <button type="button" onClick={() => labor.append({ funcao: "", quantidade: 0, horas: 0 })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Adicionar função</button>}
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
                const servicePath = `producao.${index}.eap_item_id` as const;
                const quantityPath = `producao.${index}.quantidade` as const;
                const serviceError = fieldError(servicePath);
                const quantityError = fieldError(quantityPath);
                const listId = `eap-servicos-${serviceListPrefix}-${index}`;
                const search = watchedProduction[index]?.servico_busca ?? "";
                return (
                  <div key={field.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                      <label className={`space-y-1 text-xs font-semibold ${serviceError ? "text-rose-700" : "text-slate-500"}`}>Serviço da EAP
                        <input
                          list={listId}
                          value={search || (selected ? `${selected.codigo} — ${selected.descricao}` : "")}
                          onChange={(event) => {
                            const value = event.target.value;
                            form.setValue(`producao.${index}.servico_busca`, value, { shouldDirty: true });
                            const match = services.find((service) => `${service.codigo} — ${service.descricao}` === value);
                            form.setValue(servicePath, match?.id ?? "", { shouldDirty: true, shouldValidate: true });
                          }}
                          className={`${inputClass} ${errorClass(serviceError)}`}
                          aria-invalid={serviceError ? true : undefined}
                          aria-describedby={serviceError ? fieldErrorId(servicePath) : undefined}
                          placeholder="Pesquise código ou serviço"
                        />
                        <datalist id={listId}>{services.map((service) => <option key={service.id} value={`${service.codigo} — ${service.descricao}`} />)}</datalist>
                        <InlineFieldError id={fieldErrorId(servicePath)} message={serviceError} />
                        <input type="hidden" {...form.register(servicePath)} />
                      </label>
                      <label className="space-y-1 text-xs font-semibold text-slate-500">Quantidade {selected?.unidade ? `(${selected.unidade})` : ""}
                        <input type="number" min="0" step="0.01" {...registerNumber(quantityPath)} className={`${inputClass} ${errorClass(quantityError)}`} aria-invalid={quantityError ? true : undefined} aria-describedby={quantityError ? fieldErrorId(quantityPath) : undefined} />
                        <InlineFieldError id={fieldErrorId(quantityPath)} message={quantityError} />
                      </label>
                      {canEdit && <button type="button" onClick={() => production.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>}
                    </div>
                    {selected && <p className="mt-2 text-xs text-slate-500">Saldo antes deste RDO: {formatNumber(saldo, "pt-BR")} {selected.unidade ?? ""}</p>}
                    {selected && amount > saldo && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">A quantidade informada ultrapassa o saldo em {formatNumber(amount - saldo, "pt-BR")} {selected.unidade ?? ""}. O lançamento não será bloqueado.</p>}
                  </div>
                );
              })}
              {canEdit && <button type="button" onClick={() => production.append({ eap_item_id: "", servico_busca: "", quantidade: 0, observacao: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Registrar produção</button>}
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Equipamentos</summary>
            <div className="mt-4 space-y-3">
              {equipment.fields.map((field, index) => {
                const workedPath = `equipamentos.${index}.horas_trabalhadas` as const;
                const stoppedPath = `equipamentos.${index}.horas_paradas` as const;
                const workedError = fieldError(workedPath);
                const stoppedError = fieldError(stoppedPath);
                return (
                  <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_minmax(0,1fr)_auto]">
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Equipamento<input {...form.register(`equipamentos.${index}.equipamento`)} className={inputClass} placeholder="Ex.: Betoneira" /></label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Trabalhadas
                      <input type="number" min="0" step="0.5" {...registerNumber(workedPath)} className={`${inputClass} ${errorClass(workedError)}`} aria-invalid={workedError ? true : undefined} aria-describedby={workedError ? fieldErrorId(workedPath) : undefined} />
                      <InlineFieldError id={fieldErrorId(workedPath)} message={workedError} />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Paradas
                      <input type="number" min="0" step="0.5" {...registerNumber(stoppedPath)} className={`${inputClass} ${errorClass(stoppedError)}`} aria-invalid={stoppedError ? true : undefined} aria-describedby={stoppedError ? fieldErrorId(stoppedPath) : undefined} />
                      <InlineFieldError id={fieldErrorId(stoppedPath)} message={stoppedError} />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Motivo da parada<input {...form.register(`equipamentos.${index}.motivo_parada`)} className={inputClass} /></label>
                    {canEdit && <button type="button" onClick={() => equipment.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>}
                  </div>
                );
              })}
              {canEdit && <button type="button" onClick={() => equipment.append({ equipamento: "", horas_trabalhadas: 0, horas_paradas: 0, motivo_parada: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Adicionar equipamento</button>}
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Materiais recebidos</summary>
            <div className="mt-4 space-y-3">
              {materials.fields.map((field, index) => {
                const quantityPath = `materiais.${index}.quantidade` as const;
                const quantityError = fieldError(quantityPath);
                return (
                  <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_140px_120px_auto]">
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Material<input {...form.register(`materiais.${index}.material`)} className={inputClass} /></label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Quantidade
                      <input type="number" min="0" step="0.01" {...registerNumber(quantityPath)} className={`${inputClass} ${errorClass(quantityError)}`} aria-invalid={quantityError ? true : undefined} aria-describedby={quantityError ? fieldErrorId(quantityPath) : undefined} />
                      <InlineFieldError id={fieldErrorId(quantityPath)} message={quantityError} />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Unidade<input {...form.register(`materiais.${index}.unidade`)} className={inputClass} /></label>
                    {canEdit && <button type="button" onClick={() => materials.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>}
                  </div>
                );
              })}
              {canEdit && <button type="button" onClick={() => materials.append({ material: "", quantidade: 0, unidade: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Registrar material</button>}
            </div>
          </details>

          <details open id="ocorrencias" className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Ocorrências</summary>
            <div className="mt-4 space-y-3">
              {occurrences.fields.map((field, index) => {
                const typePath = `ocorrencias.${index}.tipo` as const;
                const descriptionPath = `ocorrencias.${index}.descricao` as const;
                const typeError = fieldError(typePath);
                const descriptionError = fieldError(descriptionPath);
                return (
                  <div key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[150px_minmax(0,1fr)_110px_110px_auto]">
                    <label className={`space-y-1 text-xs font-semibold ${typeError ? "text-rose-700" : "text-slate-500"}`}>Tipo
                      <input {...form.register(typePath)} className={`${inputClass} ${errorClass(typeError)}`} aria-invalid={typeError ? true : undefined} aria-describedby={typeError ? fieldErrorId(typePath) : undefined} placeholder="Ex.: Segurança" />
                      <InlineFieldError id={fieldErrorId(typePath)} message={typeError} />
                    </label>
                    <label className={`space-y-1 text-xs font-semibold ${descriptionError ? "text-rose-700" : "text-slate-500"}`}>Descrição
                      <input {...form.register(descriptionPath)} className={`${inputClass} ${errorClass(descriptionError)}`} aria-invalid={descriptionError ? true : undefined} aria-describedby={descriptionError ? fieldErrorId(descriptionPath) : undefined} />
                      <InlineFieldError id={fieldErrorId(descriptionPath)} message={descriptionError} />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Início<input type="time" {...form.register(`ocorrencias.${index}.hora_inicio`)} className={inputClass} /></label>
                    <label className="space-y-1 text-xs font-semibold text-slate-500">Fim<input type="time" {...form.register(`ocorrencias.${index}.hora_fim`)} className={inputClass} /></label>
                    {canEdit && <button type="button" onClick={() => occurrences.remove(index)} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">Remover</button>}
                  </div>
                );
              })}
              {canEdit && <button type="button" onClick={() => occurrences.append({ tipo: "", descricao: "", hora_inicio: "", hora_fim: "" })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-emerald-800">+ Adicionar ocorrência</button>}
            </div>
          </details>

          <details open className={sectionClass}>
            <summary className="cursor-pointer text-base font-bold text-slate-900">Observações</summary>
            <textarea {...form.register("observacoes")} rows={4} className={`${inputClass} mt-4 py-3 ${errorClass(observationsError)}`} aria-invalid={observationsError ? true : undefined} aria-describedby={observationsError ? fieldErrorId("observacoes") : undefined} placeholder="Registre informações relevantes sobre o dia." />
            <InlineFieldError id={fieldErrorId("observacoes")} message={observationsError} />
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
            <label aria-live="polite" className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 ${photoBusy ? "opacity-60" : ""}`}>
              {photoBusy ? (rdoId ? "Enviando foto…" : "Salvando rascunho e enviando foto…") : "Tirar ou escolher foto"}
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
