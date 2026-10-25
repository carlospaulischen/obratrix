import { notFound } from "next/navigation";
import { EapImportWizard } from "@/components/orcamento/eap-import-wizard";
import { EapManager, type EapRow } from "@/components/orcamento/eap-manager";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { getCompanyContext } from "@/lib/company";
import { formatCurrency } from "@/lib/format";

export default async function WorkBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cliente")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const [{ data: sourceItems }, { data: rdos }, { data: centers }, { data: canEdit }] =
    await Promise.all([
      supabase
        .from("obx_eap_itens")
        .select("id,codigo,parent_id,descricao,tipo,unidade,quantidade,custo_unitario,custo_total,centro_custo_id")
        .eq("obra_id", id),
      supabase.from("obx_rdos").select("id").eq("obra_id", id),
      supabase.from("obx_centros_custo").select("id,codigo,nome").eq("empresa_id", company.id).order("codigo"),
      supabase.rpc("obx_fn_pode_editar_obra", { p_obra_id: id }),
    ]);
  const rdoIds = (rdos ?? []).map((rdo) => rdo.id);
  const { data: production } = rdoIds.length
    ? await supabase.from("obx_rdo_producao").select("eap_item_id,quantidade").in("rdo_id", rdoIds)
    : { data: [] };
  const executedByItem = new Map<string, number>();
  for (const entry of production ?? []) {
    executedByItem.set(entry.eap_item_id, (executedByItem.get(entry.eap_item_id) ?? 0) + Number(entry.quantidade));
  }
  const items: EapRow[] = (sourceItems ?? []).map((item) => ({
    ...item,
    executado: executedByItem.get(item.id) ?? 0,
  }));
  const total = items.filter((item) => item.tipo === "servico")
    .reduce((sum, item) => sum + Number(item.custo_total ?? 0), 0);

  return (
    <div className="space-y-7">
      <WorkTabs workId={work.id} active="orcamento" />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">{work.codigo} · Orçamento/EAP</p>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{work.nome}</h1>
          <p className="mt-1 text-sm text-slate-500">{work.cliente ?? "Cliente não informado"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total orçado</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(total, company.locale, company.moeda)}</p>
        </div>
      </header>
      {canEdit && <EapImportWizard workId={work.id} locale={company.locale} currency={company.moeda} />}
      <EapManager
        workId={work.id}
        items={items}
        centers={centers ?? []}
        canEdit={Boolean(canEdit)}
        locale={company.locale}
        currency={company.moeda}
      />
    </div>
  );
}
