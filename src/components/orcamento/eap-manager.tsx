"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteEapItemAction, saveEapItemAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { construirArvoreEap, percentualExecutadoEap, type NoArvoreEap } from "@/lib/orcamento/arvore";
import { formatCurrency, formatNumber } from "@/lib/format";

export type EapRow = {
  id: string;
  codigo: string;
  parent_id: string | null;
  descricao: string;
  tipo: "etapa" | "servico";
  unidade: string | null;
  quantidade: number;
  custo_unitario: number;
  custo_total: number | null;
  centro_custo_id: string | null;
  executado: number;
};

type Centro = { id: string; codigo: string; nome: string };

export function EapManager({
  workId,
  items,
  centers,
  canEdit,
  locale,
  currency,
}: {
  workId: string;
  items: EapRow[];
  centers: Centro[];
  canEdit: boolean;
  locale: string;
  currency: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(
    () => new Set(items.filter((item) => item.tipo === "etapa").map((item) => item.id)),
  );
  const [editing, setEditing] = useState<EapRow | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const tree = useMemo(() => construirArvoreEap(items), [items]);
  const rows = useMemo(() => {
    const result: { node: NoArvoreEap<EapRow>; depth: number }[] = [];
    const visit = (nodes: NoArvoreEap<EapRow>[], depth: number) => {
      for (const node of nodes) {
        result.push({ node, depth });
        if (expanded.has(node.id)) visit(node.filhos, depth + 1);
      }
    };
    visit(tree, 0);
    return result;
  }, [expanded, tree]);
  const total = tree.reduce((sum, item) => sum + item.totalOrcado, 0);

  function remove(item: EapRow) {
    if (!window.confirm(`Excluir ${item.codigo} — ${item.descricao}?`)) return;
    setNotice("");
    startTransition(async () => {
      const result = await deleteEapItemAction({ obraId: workId, itemId: item.id });
      setNotice(result.error ?? result.success ?? "");
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Estrutura analítica do projeto</h2>
          <p className="mt-1 text-xs text-slate-500">{items.length} itens · valores consolidados pelas etapas.</p>
        </div>
        {canEdit ? (
          <Button onClick={() => setEditing(null)}><Plus size={16} /> Adicionar item</Button>
        ) : (
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
            Somente leitura
          </span>
        )}
      </div>

      {items.length ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Código", "Descrição", "Un.", "Qtd.", "Custo unit.", "Total", "Qtd. executada", "% executado"].map((label) => (
                    <th key={label} className="px-3 py-3">{label}</th>
                  ))}
                  {canEdit && <th className="px-3 py-3"><span className="sr-only">Ações</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ node, depth }) => (
                  <tr key={node.id} className={node.tipo === "etapa" ? "bg-slate-50/50" : ""}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
                      <span style={{ paddingLeft: `${depth * 14}px` }} className="inline-flex items-center gap-1">
                        {node.filhos.length > 0 && (
                          <button
                            type="button"
                            aria-label={`${expanded.has(node.id) ? "Recolher" : "Expandir"} ${node.codigo}`}
                            onClick={() => setExpanded((current) => {
                              const next = new Set(current);
                              if (next.has(node.id)) next.delete(node.id);
                              else next.add(node.id);
                              return next;
                            })}
                          >
                            {expanded.has(node.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        {node.codigo}
                      </span>
                    </td>
                    <td className="max-w-64 px-3 py-3 text-slate-800">{node.descricao}</td>
                    <td className="px-3 py-3 text-slate-500">{node.unidade ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{node.tipo === "servico" ? formatNumber(node.quantidade, locale) : "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{node.tipo === "servico" ? formatCurrency(node.custo_unitario, locale, currency) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800">{formatCurrency(node.totalOrcado, locale, currency)}</td>
                    <td className="px-3 py-3 text-slate-600">{node.tipo === "etapa" ? "—" : formatNumber(node.executado, locale)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(percentualExecutado(node), locale, { maximumFractionDigits: 1 })}%</td>
                    {canEdit && <td className="px-3 py-3"><RowActions item={node} onEdit={setEditing} onDelete={remove} /></td>}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-emerald-50/70">
                <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-3 text-right font-bold text-slate-800">Total geral</td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold text-emerald-900">{formatCurrency(total, locale, currency)}</td>
                  <td colSpan={canEdit ? 3 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map(({ node, depth }) => (
              <article key={node.id} className={`rounded-2xl border p-4 ${node.tipo === "etapa" ? "border-emerald-100 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-1" style={{ paddingLeft: `${Math.min(depth * 10, 20)}px` }}>
                    {node.filhos.length > 0 && (
                      <button
                        type="button"
                        aria-label={`${expanded.has(node.id) ? "Recolher" : "Expandir"} ${node.codigo}`}
                        onClick={() => setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(node.id)) next.delete(node.id);
                          else next.add(node.id);
                          return next;
                        })}
                        className="mt-0.5 text-slate-500"
                      >
                        {expanded.has(node.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">{node.codigo} · {node.tipo}</p>
                      <h3 className="mt-1 break-words text-sm font-semibold text-slate-900">{node.descricao}</h3>
                    </div>
                  </div>
                  {canEdit && <RowActions item={node} onEdit={setEditing} onDelete={remove} />}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <MobileValue label="Un. / Qtd." value={`${node.unidade ?? "—"} · ${node.tipo === "servico" ? formatNumber(node.quantidade, locale) : "—"}`} />
                  <MobileValue label="Custo unit." value={node.tipo === "servico" ? formatCurrency(node.custo_unitario, locale, currency) : "—"} />
                  <MobileValue label="Total" value={formatCurrency(node.totalOrcado, locale, currency)} />
                  <MobileValue label="Executado" value={`${node.tipo === "etapa" ? "—" : formatNumber(node.executado, locale)} · ${formatNumber(percentualExecutado(node), locale, { maximumFractionDigits: 1 })}%`} />
                </div>
              </article>
            ))}
            <div className="flex justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              <span>Total geral</span><span>{formatCurrency(total, locale, currency)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Ainda não há itens na EAP desta obra.
        </div>
      )}

      {notice && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{notice}</p>}
      {pending && <p className="text-xs text-slate-500">Atualizando a EAP...</p>}
      {editing !== undefined && (
        <EapItemDialog
          key={editing?.id ?? "novo"}
          workId={workId}
          item={editing}
          centers={centers}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

function RowActions({
  item,
  onEdit,
  onDelete,
}: {
  item: EapRow;
  onEdit: (item: EapRow) => void;
  onDelete: (item: EapRow) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" aria-label={`Editar ${item.codigo}`} onClick={() => onEdit(item)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-800">
        <Pencil size={14} />
      </button>
      <button type="button" aria-label={`Excluir ${item.codigo}`} onClick={() => onDelete(item)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function MobileValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold text-slate-400">{label}</p><p className="mt-1 break-words font-medium text-slate-700">{value}</p></div>;
}

function percentualExecutado(node: NoArvoreEap<EapRow>) {
  return node.tipo === "etapa"
    ? percentualExecutadoEap(node)
    : node.quantidade > 0
      ? Math.min(100, Math.max(0, (node.executado / node.quantidade) * 100))
      : 0;
}

const itemFormSchema = z.object({
  codigo: z.string().trim().regex(/^\d+(?:\.\d+)*$/, "Use números separados por ponto."),
  descricao: z.string().trim().min(1, "Informe a descrição."),
  tipo: z.enum(["etapa", "servico"]),
  unidade: z.string(),
  quantidade: z.number().finite().nonnegative(),
  custoUnitario: z.number().finite().nonnegative(),
  centroCustoId: z.string(),
}).superRefine((values, context) => {
  if (values.tipo === "servico" && !values.unidade.trim()) {
    context.addIssue({ code: "custom", path: ["unidade"], message: "Informe a unidade do serviço." });
  }
  if (values.tipo === "servico" && values.quantidade <= 0) {
    context.addIssue({ code: "custom", path: ["quantidade"], message: "A quantidade deve ser maior que zero." });
  }
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

function EapItemDialog({
  workId,
  item,
  centers,
  onClose,
}: {
  workId: string;
  item: EapRow | null;
  centers: Centro[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      codigo: item?.codigo ?? "",
      descricao: item?.descricao ?? "",
      tipo: item?.tipo ?? "etapa",
      unidade: item?.unidade ?? "",
      quantidade: item?.quantidade ?? 0,
      custoUnitario: item?.custo_unitario ?? 0,
      centroCustoId: item?.centro_custo_id ?? "",
    },
  });

  const submit = handleSubmit((values) => startTransition(async () => {
    setError("");
    const result = await saveEapItemAction({
      obraId: workId,
      id: item?.id,
      ...values,
      unidade: values.unidade || null,
      centroCustoId: values.centroCustoId || null,
    });
    if (result.error) setError(result.error);
    else {
      onClose();
      router.refresh();
    }
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="eap-dialog-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-7">
        <h2 id="eap-dialog-title" className="text-lg font-bold text-slate-900">{item ? "Editar item da EAP" : "Adicionar item à EAP"}</h2>
        <p className="mt-1 text-xs text-slate-500">O nível pai é associado automaticamente pelo código.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código" error={errors.codigo?.message}><input {...register("codigo")} className={fieldClass} placeholder="Ex.: 1.2.3" /></Field>
            <Field label="Tipo" error={errors.tipo?.message}>
              <select {...register("tipo")} className={fieldClass}><option value="etapa">Etapa</option><option value="servico">Serviço</option></select>
            </Field>
            <Field label="Descrição" error={errors.descricao?.message} className="sm:col-span-2"><input {...register("descricao")} className={fieldClass} /></Field>
            <Field label="Unidade" error={errors.unidade?.message}><input {...register("unidade")} className={fieldClass} placeholder="m², un., kg..." /></Field>
            <Field label="Quantidade" error={errors.quantidade?.message}><input {...register("quantidade", { valueAsNumber: true })} type="number" min="0" step="0.0001" className={fieldClass} /></Field>
            <Field label="Custo unitário" error={errors.custoUnitario?.message}><input {...register("custoUnitario", { valueAsNumber: true })} type="number" min="0" step="0.0001" className={fieldClass} /></Field>
            <Field label="Centro de custo">
              <select {...register("centroCustoId")} className={fieldClass}>
                <option value="">Sem centro de custo</option>
                {centers.map((center) => <option key={center.id} value={center.id}>{center.codigo} · {center.nome}</option>)}
              </select>
            </Field>
          </div>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar item"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10";

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return <label className={`block space-y-1.5 ${className}`}><span className="text-xs font-semibold text-slate-600">{label}</span>{children}{error && <span className="block text-[11px] text-rose-600">{error}</span>}</label>;
}
