import { notFound, redirect } from "next/navigation";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { CostImportWizard } from "@/components/custos/import-wizard";
import { CustosManager } from "@/components/custos/custos-manager";
import { categoriasCusto } from "@/lib/custos/categorias";
import { getCompanyContext } from "@/lib/company";
import { dataHoje } from "@/lib/rdo/data";

const categoriaValues = new Set(categoriasCusto.map((item) => item.value));

export default async function WorkCostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; categoria?: string; centro?: string; servico?: string }>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase.from("obx_obras").select("id,codigo,nome")
    .eq("id", id).eq("empresa_id", company.id).maybeSingle();
  if (!work) notFound();

  const [{ data: canView }, { data: canEdit }, { data: services }, { data: centers }] = await Promise.all([
    supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: id }),
    supabase.rpc("obx_fn_pode_editar_custo", { p_obra_id: id }),
    supabase.from("obx_eap_itens").select("id,codigo,descricao").eq("obra_id", id).eq("tipo", "servico").order("codigo"),
    supabase.from("obx_centros_custo").select("id,codigo,nome").eq("empresa_id", company.id).order("codigo"),
  ]);
  if (!canView) redirect("/app");

  let query = supabase.from("obx_custos")
    .select("id,data,descricao,categoria,valor,fornecedor,documento,eap_item_id,centro_custo_id")
    .eq("obra_id", id)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  const month = /^\d{4}-\d{2}$/.test(filters.mes ?? "") ? filters.mes! : "";
  if (month) {
    const start = `${month}-01`;
    const nextMonth = new Date(`${start}T00:00:00.000Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    query = query.gte("data", start).lt("data", nextMonth.toISOString().slice(0, 10));
  }
  if (filters.categoria && categoriaValues.has(filters.categoria as typeof categoriasCusto[number]["value"])) {
    query = query.eq("categoria", filters.categoria as typeof categoriasCusto[number]["value"]);
  }
  if (filters.centro && centers?.some((center) => center.id === filters.centro)) {
    query = query.eq("centro_custo_id", filters.centro);
  }
  if (filters.servico && services?.some((service) => service.id === filters.servico)) {
    query = query.eq("eap_item_id", filters.servico);
  }
  const { data: costs, error } = await query;
  if (error) throw new Error("Não foi possível carregar os custos da obra.");
  const rows = costs ?? [];
  const categoryTotals = Array.from(
    rows.reduce((totals, cost) => totals.set(cost.categoria, (totals.get(cost.categoria) ?? 0) + Number(cost.valor)), new Map<string, number>()),
    ([categoria, valor]) => ({ categoria: categoria as typeof categoriasCusto[number]["value"], valor }),
  ).sort((a, b) => b.valor - a.valor);
  const total = rows.reduce((sum, cost) => sum + Number(cost.valor), 0);

  return (
    <div className="space-y-6">
      <WorkTabs workId={work.id} active="custos" showCosts />
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">{work.codigo} · Custos reais</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{work.nome}</h1>
        <p className="mt-2 text-sm text-slate-500">Lançamentos realizados, relacionados à EAP e aos centros de custo.</p>
      </header>
      <form method="get" className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-semibold text-slate-600">Mês<input name="mes" type="month" defaultValue={month} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">Categoria<select name="categoria" defaultValue={filters.categoria ?? ""} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Todas</option>{categoriasCusto.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">Centro de custo<select name="centro" defaultValue={filters.centro ?? ""} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Todos</option>{(centers ?? []).map((center) => <option key={center.id} value={center.id}>{center.codigo} · {center.nome}</option>)}</select></label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">Serviço EAP<select name="servico" defaultValue={filters.servico ?? ""} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Todos</option>{(services ?? []).map((service) => <option key={service.id} value={service.id}>{service.codigo} · {service.descricao}</option>)}</select></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="min-h-10 rounded-lg bg-emerald-800 px-4 text-xs font-semibold text-white">Aplicar filtros</button><a href={`/app/obras/${id}/custos`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600">Limpar</a></div>
      </form>
      {canEdit && <CostImportWizard workId={work.id} locale={company.locale} currency={company.moeda} />}
      <CustosManager
        workId={work.id}
        costs={rows}
        services={services ?? []}
        centers={centers ?? []}
        categoryTotals={categoryTotals}
        total={total}
        canEdit={Boolean(canEdit)}
        locale={company.locale}
        currency={company.moeda}
        today={dataHoje(company.fuso_horario)}
      />
    </div>
  );
}
