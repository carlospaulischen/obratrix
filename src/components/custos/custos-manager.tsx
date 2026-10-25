"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteCostAction, saveCostAction } from "@/app/app/obras/[id]/custos/actions";
import { categoriasCusto, categoriaCustoLabel } from "@/lib/custos/categorias";
import { parseValorCusto } from "@/lib/custos/parse-planilha";
import { formatCurrency, formatDate } from "@/lib/format";

type CostRow = {
  id: string;
  data: string;
  descricao: string;
  categoria: "mao_obra" | "material" | "equipamento" | "servico_terceiro" | "indireto";
  valor: number;
  fornecedor: string | null;
  documento: string | null;
  eap_item_id: string | null;
  centro_custo_id: string | null;
};
type Service = { id: string; codigo: string; descricao: string };
type Center = { id: string; codigo: string; nome: string };
type CategoryTotal = { categoria: CostRow["categoria"]; valor: number };

const costFormSchema = z.object({
  data: z.string().min(1, "Informe a data."),
  descricao: z.string().trim().min(1, "Informe a descrição."),
  categoria: z.enum(["mao_obra", "material", "equipamento", "servico_terceiro", "indireto"]),
  valor: z.string().trim().min(1, "Informe o valor.").refine((value) => {
    const number = parseValorCusto(value);
    return number !== undefined && number > 0;
  }, "Informe um valor maior que zero."),
  fornecedor: z.string(),
  documento: z.string(),
  eapItemId: z.string(),
  serviceQuery: z.string(),
  centroCustoId: z.string(),
}).superRefine((values, context) => {
  if (values.serviceQuery.trim() && !values.eapItemId) {
    context.addIssue({ code: "custom", path: ["eapItemId"], message: "Selecione um serviço da lista." });
  }
});

type CostForm = z.infer<typeof costFormSchema>;
const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export function CustosManager({
  workId,
  costs,
  services,
  centers,
  categoryTotals,
  total,
  canEdit,
  locale,
  currency,
  today,
}: {
  workId: string;
  costs: CostRow[];
  services: Service[];
  centers: Center[];
  categoryTotals: CategoryTotal[];
  total: number;
  canEdit: boolean;
  locale: string;
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CostRow | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  function remove(cost: CostRow) {
    if (!window.confirm(`Excluir o lançamento “${cost.descricao}”?`)) return;
    setNotice("");
    startTransition(async () => {
      const result = await deleteCostAction({ obraId: workId, id: cost.id });
      setNotice(result.error ?? result.success ?? "");
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Total do filtro" value={formatCurrency(total, locale, currency)} />
        {categoryTotals.map((entry) => (
          <Metric key={entry.categoria} label={categoriaCustoLabel[entry.categoria]} value={formatCurrency(entry.valor, locale, currency)} />
        ))}
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-bold text-slate-900">Lançamentos</h2>
            <p className="mt-1 text-xs text-slate-500">{costs.length} registro(s) no filtro atual</p>
          </div>
          {canEdit && <Button type="button" onClick={() => setEditing(null)}><Plus size={16} /> Novo lançamento</Button>}
        </div>
        {costs.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>{["Data", "Descrição", "Categoria", "Serviço EAP", "Centro de custo", "Fornecedor", "Valor", ...(canEdit ? [""] : [])].map((label, index) => <th key={`${label}-${index}`} className="px-4 py-3 font-bold">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costs.map((cost) => (
                    <tr key={cost.id} className="text-slate-700">
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(cost.data, locale)}</td>
                      <td className="max-w-56 px-4 py-3"><p className="truncate font-semibold text-slate-900">{cost.descricao}</p><p className="mt-1 text-[10px] text-slate-400">{cost.documento ?? "—"}</p></td>
                      <td className="px-4 py-3">{categoriaCustoLabel[cost.categoria]}</td>
                      <td className="max-w-48 truncate px-4 py-3">{cost.eap_item_id ? `${serviceById.get(cost.eap_item_id)?.codigo ?? ""} ${serviceById.get(cost.eap_item_id)?.descricao ?? ""}` : "—"}</td>
                      <td className="px-4 py-3">{centers.find((center) => center.id === cost.centro_custo_id)?.nome ?? "—"}</td>
                      <td className="px-4 py-3">{cost.fornecedor ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(cost.valor, locale, currency)}</td>
                      {canEdit && <td className="whitespace-nowrap px-3 py-3"><RowControls cost={cost} onEdit={setEditing} onDelete={remove} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 md:hidden">
              {costs.map((cost) => (
                <article key={cost.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">{formatDate(cost.data, locale)} · {categoriaCustoLabel[cost.categoria]}</p><h3 className="mt-1 break-words text-sm font-semibold text-slate-900">{cost.descricao}</h3></div>
                    {canEdit && <RowControls cost={cost} onEdit={setEditing} onDelete={remove} />}
                  </div>
                  <p className="mt-3 break-words text-xs text-slate-500">{cost.eap_item_id ? `${serviceById.get(cost.eap_item_id)?.codigo ?? ""} · ${serviceById.get(cost.eap_item_id)?.descricao ?? ""}` : "Sem serviço EAP"}</p>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-[11px] text-slate-500">{cost.fornecedor ?? "Sem fornecedor"} · {centers.find((center) => center.id === cost.centro_custo_id)?.nome ?? "Sem centro"}</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(cost.valor, locale, currency)}</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhum lançamento encontrado com os filtros atuais.</p>
        )}
      </section>
      {notice && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{notice}</p>}
      {pending && <p className="text-xs text-slate-500">Atualizando lançamentos...</p>}
      {editing !== undefined && (
        <CostDialog
          key={editing?.id ?? "novo"}
          workId={workId}
          cost={editing}
          services={services}
          centers={centers}
          today={today}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setNotice(message);
            setEditing(undefined);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CostDialog({
  workId,
  cost,
  services,
  centers,
  today,
  onClose,
  onSaved,
}: {
  workId: string;
  cost: CostRow | null;
  services: Service[];
  centers: Center[];
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState("");
  const [pending, startTransition] = useTransition();
  const service = cost?.eap_item_id ? services.find((item) => item.id === cost.eap_item_id) : undefined;
  const form = useForm<CostForm>({
    resolver: zodResolver(costFormSchema),
    defaultValues: {
      data: cost?.data ?? today,
      descricao: cost?.descricao ?? "",
      categoria: cost?.categoria ?? "material",
      valor: cost ? String(cost.valor).replace(".", ",") : "",
      fornecedor: cost?.fornecedor ?? "",
      documento: cost?.documento ?? "",
      eapItemId: cost?.eap_item_id ?? "",
      serviceQuery: service ? `${service.codigo} — ${service.descricao}` : "",
      centroCustoId: cost?.centro_custo_id ?? "",
    },
  });
  const serviceQuery = useWatch({ control: form.control, name: "serviceQuery" });
  const suggestions = serviceQuery.trim()
    ? services.filter((entry) => `${entry.codigo} — ${entry.descricao}`.toLocaleLowerCase("pt-BR").includes(serviceQuery.toLocaleLowerCase("pt-BR"))).slice(0, 20)
    : services.slice(0, 20);
  const errors = form.formState.errors;

  function submit(values: CostForm) {
    setServerError("");
    const valor = parseValorCusto(values.valor);
    if (valor === undefined) return;
    startTransition(async () => {
      const result = await saveCostAction({
        obraId: workId,
        id: cost?.id,
        data: values.data,
        descricao: values.descricao,
        categoria: values.categoria,
        valor,
        fornecedor: values.fornecedor,
        documento: values.documento,
        eapItemId: values.eapItemId || null,
        centroCustoId: values.centroCustoId || null,
      });
      if (result.error) setServerError(result.error);
      else onSaved(result.success ?? "Lançamento salvo.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cost-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="cost-dialog-title" className="text-lg font-bold text-slate-900">{cost ? "Editar lançamento" : "Novo lançamento"}</h2><p className="mt-1 text-xs text-slate-500">Preencha os dados do custo realizado.</p></div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" error={errors.data?.message}><input type="date" max={today} className={inputClass} {...form.register("data")} /></Field>
            <Field label="Categoria" error={errors.categoria?.message}><select className={inputClass} {...form.register("categoria")}>{categoriasCusto.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></Field>
          </div>
          <Field label="Descrição" error={errors.descricao?.message}><input className={inputClass} {...form.register("descricao")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor (R$)" error={errors.valor?.message}><input inputMode="decimal" placeholder="1.234,56" className={inputClass} {...form.register("valor")} /></Field>
            <Field label="Fornecedor" error={errors.fornecedor?.message}><input className={inputClass} {...form.register("fornecedor")} /></Field>
          </div>
          <Field label="Documento" error={errors.documento?.message}><input className={inputClass} {...form.register("documento")} /></Field>
          <Field label="Serviço da EAP (opcional)" error={errors.eapItemId?.message}>
            <input
              list={`cost-services-${workId}`}
              autoComplete="off"
              placeholder="Digite para buscar e selecione um serviço"
              className={inputClass}
              {...form.register("serviceQuery", {
                onChange: (event) => {
                  const selected = services.find((entry) => `${entry.codigo} — ${entry.descricao}` === event.target.value);
                  form.setValue("eapItemId", selected?.id ?? "", { shouldValidate: true });
                },
              })}
            />
            <datalist id={`cost-services-${workId}`}>{suggestions.map((entry) => <option key={entry.id} value={`${entry.codigo} — ${entry.descricao}`} />)}</datalist>
          </Field>
          <Field label="Centro de custo (opcional)" error={errors.centroCustoId?.message}>
            <select className={inputClass} {...form.register("centroCustoId")}><option value="">Sem centro de custo</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.codigo} · {center.nome}</option>)}</select>
          </Field>
          {serverError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{serverError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar lançamento"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-semibold text-slate-700"><span>{label}</span>{children}{error && <span role="alert" className="block text-[11px] font-medium text-rose-700">{error}</span>}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl border border-slate-200/70 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-bold text-slate-900">{value}</p></article>;
}

function RowControls({ cost, onEdit, onDelete }: { cost: CostRow; onEdit: (cost: CostRow) => void; onDelete: (cost: CostRow) => void }) {
  return <div className="flex shrink-0 gap-1"><button type="button" aria-label={`Editar ${cost.descricao}`} onClick={() => onEdit(cost)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-800"><Pencil size={14} /></button><button type="button" aria-label={`Excluir ${cost.descricao}`} onClick={() => onDelete(cost)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></div>;
}
