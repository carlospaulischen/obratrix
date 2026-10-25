import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CircleDollarSign, HardHat, Plus, TrendingUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCompanyContext } from "@/lib/company";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { carregarIndicadoresObras } from "@/lib/indicadores/carregar";
import { dataHoje } from "@/lib/rdo/data";

const statusText: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  paralisada: "Paralisada",
  concluida: "Concluída",
};

export default async function DashboardPage() {
  const { supabase, company, perfil } = await getCompanyContext();
  const today = dataHoje(company.fuso_horario);
  const { data: works } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cliente,data_inicio,data_fim_prevista,valor_contrato,status,cidade,uf")
    .eq("empresa_id", company.id)
    .order("updated_at", { ascending: false });
  const portfolio = await carregarIndicadoresObras(supabase, works ?? [], today, company.id, { locale: company.locale, moeda: company.moeda });
  const contractTotal = (works ?? []).reduce((total, work) => total + Number(work.valor_contrato ?? 0), 0);
  const costTotal = portfolio.reduce((total, entry) => total + entry.indicadores.custoReal, 0);
  const rdosToday = (works ?? []).length
    ? await supabase.from("obx_rdos").select("id").in("obra_id", works!.map((work) => work.id)).eq("data", today)
    : { data: [] };
  const rdoIdsToday = (rdosToday.data ?? []).map((rdo) => rdo.id);
  const laborToday = rdoIdsToday.length
    ? await supabase.from("obx_rdo_mao_obra").select("quantidade").in("rdo_id", rdoIdsToday)
    : { data: [] };
  const peopleToday = (laborToday.data ?? []).reduce((sum, row) => sum + Number(row.quantidade), 0);
  const visiblePortfolio = portfolio.map((entry) => ({
    ...entry,
    alertas: entry.alertas.filter((alert) => perfil !== "encarregado"
      || alert.id === "sem-rdo" || alert.id === "queda-producao"
      || alert.id.startsWith("rascunho-") || alert.id.startsWith("producao-")),
  }));
  const alerts = visiblePortfolio.flatMap((entry) => entry.alertas.map((alert) => ({ ...alert, obra: entry.work })))
    .sort((a, b) => (a.severidade === "critico" ? 0 : 1) - (b.severidade === "critico" ? 0 : 1))
    .slice(0, 8);
  const canViewFinancials = perfil !== "encarregado";

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Visão geral da operação</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-[34px]">Obras em movimento, com dados claros.</h1>
          <p className="mt-2 text-sm text-slate-500">Resumo de execução da {company.nome}.</p>
        </div>
        {perfil === "diretor" && (
          <Button asChild>
            <Link href="/app/obras/nova"><Plus size={17} /> Nova obra</Link>
          </Button>
        )}
      </section>

      <section className={`grid gap-4 sm:grid-cols-2 ${canViewFinancials ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
        {[
          { label: "Obras ativas", value: String((works ?? []).filter((work) => work.status === "em_andamento").length).padStart(2, "0"), note: "em andamento", icon: BriefcaseBusiness, tint: "bg-emerald-50 text-emerald-800", visible: true },
          { label: "Valor contratado", value: formatCurrency(contractTotal, company.locale, company.moeda), note: "nas obras visíveis", icon: CircleDollarSign, tint: "bg-blue-50 text-blue-700", visible: canViewFinancials },
          { label: "Custos registrados", value: formatCurrency(costTotal, company.locale, company.moeda), note: "acumulado", icon: TrendingUp, tint: "bg-amber-50 text-amber-700", visible: canViewFinancials },
          { label: "Equipe em campo", value: formatNumber(peopleToday, company.locale), note: "pessoas nos RDOs de hoje", icon: HardHat, tint: "bg-violet-50 text-violet-700", visible: true },
        ].filter((item) => item.visible).map(({ label, value, note, icon: Icon, tint }) => (
          <article key={label} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_10px_rgba(20,44,32,0.025)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-3 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
              </div>
              <div className={`flex size-10 items-center justify-center rounded-xl ${tint}`}><Icon size={19} /></div>
            </div>
            <p className="mt-3 text-xs text-slate-400">{note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
          <div>
            <h2 className="font-bold text-slate-900">Portfólio de obras</h2>
            <p className="mt-1 text-xs text-slate-500">Avanço físico, prazo e custos previstos versus realizados</p>
          </div>
          <Link href="/app/obras" className="flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline">
            Ver todas <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {visiblePortfolio.map(({ work, indicadores, alertas: workAlerts }) => (
            <Link key={work.id} href={`/app/obras/${work.id}`} className={`grid gap-3 px-5 py-5 transition hover:bg-slate-50/60 sm:px-7 xl:items-center ${canViewFinancials ? "xl:grid-cols-[1.5fr_1fr_0.6fr_0.6fr_1.2fr_auto]" : "xl:grid-cols-[1.5fr_1fr_auto]"}`}>
              <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{work.codigo} · {work.nome}</p><p className="mt-1 truncate text-xs text-slate-500">{statusText[work.status] ?? work.status} · Entrega {formatDate(work.data_fim_prevista, company.locale)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Avanço físico × planejado</p><p className="mt-1 text-xs font-semibold text-slate-800">{formatNumber(indicadores.valorAgregado / (indicadores.orcado || 1) * 100, company.locale, { maximumFractionDigits: 1 })}% × {formatNumber(indicadores.planejadoPct * 100, company.locale, { maximumFractionDigits: 1 })}%</p></div>
              {canViewFinancials ? <><p className="text-xs text-slate-700">IDC <strong>{formatNumber(indicadores.idc, company.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p><p className="text-xs text-slate-700">IDP <strong>{formatNumber(indicadores.idp, company.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">EAC × BAC</p><p className="mt-1 text-xs font-semibold">{formatCurrency(indicadores.custoFinalPrevisto, company.locale, company.moeda)} × {formatCurrency(indicadores.orcado, company.locale, company.moeda)}</p></div></> : null}
              <span className="flex items-center gap-2 text-xs text-slate-600"><TriangleAlert size={15} className="text-amber-700" />{workAlerts.filter((item) => item.severidade === "critico").length} crítico(s) · {workAlerts.filter((item) => item.severidade === "atencao").length} atenção</span>
            </Link>
          ))}
          {!works?.length && (
            <div className="px-7 py-14 text-center">
              <p className="font-semibold text-slate-800">Sua primeira obra começa aqui.</p>
              <p className="mt-2 text-sm text-slate-500">Cadastre uma obra para organizar o trabalho da equipe.</p>
              {perfil === "diretor" && (
                <Button asChild className="mt-5"><Link href="/app/obras/nova">Cadastrar obra</Link></Button>
              )}
            </div>
          )}
        </div>
      </section>
      {alerts.length > 0 && (
        <section className="rounded-2xl border border-slate-200/70 bg-white">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-7"><h2 className="font-bold text-slate-900">Alertas prioritários</h2><p className="mt-1 text-xs text-slate-500">Até oito alertas mais graves das obras visíveis</p></div>
          <ul className="divide-y divide-slate-100">
            {alerts.map((alert) => <li key={`${alert.obra.id}-${alert.id}`}><Link href={alert.link} className="flex gap-3 px-5 py-4 hover:bg-slate-50 sm:px-7"><TriangleAlert size={17} className={alert.severidade === "critico" ? "text-rose-600" : "text-amber-600"} /><span><strong className="block text-sm text-slate-800">{alert.titulo}</strong><span className="mt-1 block text-xs text-slate-500">{alert.obra.codigo} · {alert.detalhe}</span></span></Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
