import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { WorkMemberForm } from "@/components/membership-forms";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { Button } from "@/components/ui/button";
import { getCompanyContext } from "@/lib/company";
import { CurvaS } from "@/components/indicadores/curva-s";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { carregarIndicadoresObras } from "@/lib/indicadores/carregar";
import { dataHoje, inicioDaSemana } from "@/lib/rdo/data";

const statusLabels: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  paralisada: "Paralisada",
  concluida: "Concluída",
};

export default async function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, company, perfil } = await getCompanyContext();
  const today = dataHoje(company.fuso_horario);
  const weekStart = inicioDaSemana(today);
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cliente,endereco,cidade,uf,data_inicio,data_fim_prevista,valor_contrato,status")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const [{ data: workMemberRows }, { data: recentRdos }, { data: weekRdos }, { data: canViewCosts }] = await Promise.all([
    supabase.from("obx_obra_membros").select("usuario_id").eq("obra_id", id),
    supabase.from("obx_rdos").select("id,data,status").eq("obra_id", id).order("data", { ascending: false }).limit(5),
    supabase.from("obx_rdos").select("id").eq("obra_id", id).gte("data", weekStart).lte("data", today),
    supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: id }),
  ]);
  const [indicators] = await carregarIndicadoresObras(supabase, [{
    id: work.id,
    codigo: work.codigo,
    nome: work.nome,
    status: work.status,
    data_inicio: work.data_inicio,
    data_fim_prevista: work.data_fim_prevista,
  }], today, company.id, { locale: company.locale, moeda: company.moeda });
  const recentRdoIds = (recentRdos ?? []).map((rdo) => rdo.id);
  const weekRdoIds = (weekRdos ?? []).map((rdo) => rdo.id);
  const [{ data: recentLabor }, { data: recentOccurrences }, { data: weeklyProduction }] = await Promise.all([
    recentRdoIds.length
      ? supabase.from("obx_rdo_mao_obra").select("rdo_id,quantidade").in("rdo_id", recentRdoIds)
      : Promise.resolve({ data: [] }),
    recentRdoIds.length
      ? supabase.from("obx_rdo_ocorrencias").select("rdo_id").in("rdo_id", recentRdoIds)
      : Promise.resolve({ data: [] }),
    weekRdoIds.length
      ? supabase.from("obx_rdo_producao").select("eap_item_id,quantidade").in("rdo_id", weekRdoIds)
      : Promise.resolve({ data: [] }),
  ]);
  const peopleByRdo = new Map<string, number>();
  for (const line of recentLabor ?? []) {
    peopleByRdo.set(line.rdo_id, (peopleByRdo.get(line.rdo_id) ?? 0) + Number(line.quantidade));
  }
  const occurrencesByRdo = new Map<string, number>();
  for (const line of recentOccurrences ?? []) {
    occurrencesByRdo.set(line.rdo_id, (occurrencesByRdo.get(line.rdo_id) ?? 0) + 1);
  }
  const quantitiesByService = new Map<string, number>();
  for (const line of weeklyProduction ?? []) {
    quantitiesByService.set(line.eap_item_id, (quantitiesByService.get(line.eap_item_id) ?? 0) + Number(line.quantidade));
  }
  const weeklyServiceIds = Array.from(quantitiesByService.keys());
  const { data: weeklyServices } = weeklyServiceIds.length
    ? await supabase.from("obx_eap_itens").select("id,codigo,descricao,unidade").in("id", weeklyServiceIds)
    : { data: [] };
  const weeklySummary = (weeklyServices ?? [])
    .map((service) => ({ ...service, quantidade: quantitiesByService.get(service.id) ?? 0 }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  const memberIds = (workMemberRows ?? []).map((entry) => entry.usuario_id);
  const [{ data: workProfiles }, { data: companyMemberships }] = await Promise.all([
    memberIds.length
      ? supabase.from("obx_usuarios").select("id,nome,email").in("id", memberIds)
      : Promise.resolve({ data: [] }),
    perfil === "diretor"
      ? supabase.from("obx_empresa_membros").select("usuario_id,perfil").eq("empresa_id", company.id)
      : Promise.resolve({ data: [] }),
  ]);
  const { data: companyProfiles } = companyMemberships?.length
    ? await supabase.from("obx_usuarios").select("id,nome,email").in("id", companyMemberships.map((entry) => entry.usuario_id))
    : { data: [] };
  const profileById = new Map((companyProfiles?.length ? companyProfiles : workProfiles ?? []).map((profile) => [profile.id, profile]));
  const workMemberSet = new Set(memberIds);
  const availableMembers = (companyMemberships ?? []).filter((member) => !workMemberSet.has(member.usuario_id));

  const progress = indicators?.indicadores.orcado
    ? indicators.indicadores.valorAgregado / indicators.indicadores.orcado * 100
    : 0;
  const contract = Number(work.valor_contrato ?? 0);
  const location = [work.endereco, [work.cidade, work.uf].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
  const metrics = indicators?.indicadores;
  const visibleAlerts = (indicators?.alertas ?? []).filter((alert) =>
    Boolean(canViewCosts) || alert.id === "sem-rdo" || alert.id === "queda-producao"
      || alert.id.startsWith("rascunho-") || alert.id.startsWith("producao-")
  );

  return (
    <div className="min-w-0 space-y-7">
      <Link href="/app/obras" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800">
        <ArrowLeft size={15} /> Todas as obras
      </Link>

      <WorkTabs workId={work.id} active="resumo" showCosts={Boolean(canViewCosts)} />

      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><span className="text-sm font-bold">OB</span></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{work.codigo} <span className="px-1">·</span> {statusLabels[work.status] ?? work.status}</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{work.nome}</h1>
              <p className="mt-2 text-sm text-slate-500">{work.cliente ?? "Cliente não informado"}</p>
              {location && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><MapPin size={14} />{location}</p>}
            </div>
          </div>
          {perfil === "diretor" && (
            <Button asChild variant="outline" className="shrink-0">
              <Link href={`/app/obras/${work.id}/editar`}><Pencil size={15} /> Editar obra</Link>
            </Button>
          )}
        </div>

        <div className={`mt-7 grid gap-4 border-t border-slate-100 pt-6 ${canViewCosts ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {canViewCosts && <Metric label="Valor do contrato" value={formatCurrency(contract, company.locale, company.moeda)} note="valor acordado com o cliente" />}
          <Metric label="Início da obra" value={formatDate(work.data_inicio, company.locale)} note="data de mobilização" />
          <Metric label="Entrega prevista" value={formatDate(work.data_fim_prevista, company.locale)} note="cronograma linear inicial" />
        </div>
      </section>

      <section className={`grid gap-4 ${canViewCosts ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
        <SummaryCard label="Avanço físico × planejado" value={`${formatNumber(progress, company.locale, { maximumFractionDigits: 1 })}% × ${formatNumber((metrics?.planejadoPct ?? 0) * 100, company.locale, { maximumFractionDigits: 1 })}%`} detail="produção confirmada versus cronograma linear" percent={progress} accent="emerald" />
        {canViewCosts && metrics && <>
          <SummaryCard label="IDC · custo / valor executado" value={formatNumber(metrics.idc, company.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} detail="maior que 1 indica eficiência de custo" />
          <SummaryCard label="IDP · avanço / planejado" value={formatNumber(metrics.idp, company.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} detail="maior que 1 indica avanço adiantado" />
          <SummaryCard label="Custo real × valor agregado" value={`${formatCurrency(metrics.custoReal, company.locale, company.moeda)} × ${formatCurrency(metrics.valorAgregado, company.locale, company.moeda)}`} detail="AC × EV" accent="amber" />
          <SummaryCard label="Custo final previsto × orçamento" value={`${formatCurrency(metrics.custoFinalPrevisto, company.locale, company.moeda)} × ${formatCurrency(metrics.orcado, company.locale, company.moeda)}`} detail={`Desvio previsto ${formatCurrency(metrics.desvioPrevisto, company.locale, company.moeda)}`} accent={metrics.desvioPrevisto > 0 ? "rose" : "emerald"} />
        </>}
      </section>

      {canViewCosts && metrics && (
        <>
          <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
            <div className="mb-4"><h2 className="font-bold text-slate-900">Curva S · previsto × realizado</h2><p className="mt-1 text-xs text-slate-500">Valores acumulados por semana, de segunda a domingo.</p></div>
            <CurvaS points={metrics.curvaS} locale={company.locale} currency={company.moeda} />
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
              <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Serviços com maior desvio</h2><p className="mt-1 text-xs text-slate-500">Custo real menos valor agregado.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Código / serviço</th><th className="px-4 py-3 text-right">Orçado</th><th className="px-4 py-3 text-right">Real</th><th className="px-4 py-3 text-right">Desvio</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.porServico.slice().sort((a, b) => b.desvio - a.desvio).slice(0, 10).map((service) => <tr key={service.id}><td className="max-w-60 px-4 py-3"><strong>{service.codigo}</strong><span className="ml-2 text-slate-600">{service.descricao}</span></td><td className="whitespace-nowrap px-4 py-3 text-right">{formatCurrency(service.orcado, company.locale, company.moeda)}</td><td className="whitespace-nowrap px-4 py-3 text-right">{formatCurrency(service.custoReal, company.locale, company.moeda)}</td><td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${service.desvio > 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatCurrency(service.desvio, company.locale, company.moeda)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
              <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Resumo por centro de custo</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Centro</th><th className="px-4 py-3 text-right">Orçado</th><th className="px-4 py-3 text-right">EV</th><th className="px-4 py-3 text-right">Real</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{metrics.porCentro.map((center) => <tr key={center.centroCustoId ?? "sem-centro"}><td className="px-4 py-3 font-medium">{center.nome}</td><td className="px-4 py-3 text-right">{formatCurrency(center.orcado, company.locale, company.moeda)}</td><td className="px-4 py-3 text-right">{formatCurrency(center.valorAgregado, company.locale, company.moeda)}</td><td className="px-4 py-3 text-right">{formatCurrency(center.custoReal, company.locale, company.moeda)}</td></tr>)}</tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      )}

      {visibleAlerts.length > 0 && (
        <section className="rounded-2xl border border-slate-200/70 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="flex items-center gap-2 font-bold text-slate-900"><TriangleAlert size={17} className="text-amber-700" /> Alertas da obra</h2></div>
          <ul className="divide-y divide-slate-100">
            {visibleAlerts.map((alert) => <li key={alert.id}><Link href={alert.link} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50"><TriangleAlert size={16} className={alert.severidade === "critico" ? "text-rose-600" : "text-amber-600"} /><span><strong className="text-sm text-slate-800">{alert.titulo}</strong><span className="mt-1 block text-xs text-slate-500">{alert.detalhe}</span></span></Link></li>)}
          </ul>
        </section>
      )}

      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <article className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900">Últimos RDOs</h2>
              <p className="mt-1 text-xs text-slate-500">Registros mais recentes da obra.</p>
            </div>
            <Link href={`/app/obras/${work.id}/rdo`} className="shrink-0 text-xs font-semibold text-emerald-800 hover:underline">Ver todos</Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {(recentRdos ?? []).map((rdo) => (
              <Link key={rdo.id} href={`/app/obras/${work.id}/rdo/${rdo.data}`} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{formatDate(rdo.data, company.locale)}</span>
                  <span className="mt-1 block text-xs text-slate-500">{peopleByRdo.get(rdo.id) ?? 0} pessoas · {occurrencesByRdo.get(rdo.id) ?? 0} ocorrências</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${rdo.status === "confirmado" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                  {rdo.status === "confirmado" ? "Confirmado" : "Rascunho"}
                </span>
              </Link>
            ))}
            {!recentRdos?.length && <p className="py-5 text-sm text-slate-500">Ainda não há RDOs registrados.</p>}
          </div>
        </article>

        <article className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
          <h2 className="font-bold text-slate-900">Produção da semana</h2>
          <p className="mt-1 text-xs text-slate-500">Quantidades lançadas desde {formatDate(weekStart, company.locale)}.</p>
          <div className="mt-4 divide-y divide-slate-100">
            {weeklySummary.map((service) => (
              <div key={service.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-500">{service.codigo}</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-slate-800">{service.descricao}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-slate-900">{formatNumber(service.quantidade, company.locale)} {service.unidade ?? ""}</span>
              </div>
            ))}
            {!weeklySummary.length && <p className="py-5 text-sm text-slate-500">Sem produção lançada nesta semana.</p>}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><UsersRound size={17} className="text-slate-400" /> Equipe da obra</h2>
            <p className="mt-1 text-xs text-slate-500">Pessoas vinculadas a esta frente de trabalho.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{memberIds.length}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {memberIds.map((memberId) => {
            const profile = profileById.get(memberId);
            return (
              <div key={memberId} className="flex items-center gap-3 px-5 py-4 sm:px-7">
                <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {(profile?.nome ?? profile?.email ?? "?").slice(0, 1).toLocaleUpperCase("pt-BR")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{profile?.nome ?? "Membro da obra"}</p>
                  <p className="truncate text-xs text-slate-400">{profile?.email ?? ""}</p>
                </div>
              </div>
            );
          })}
          {!memberIds.length && <p className="px-7 py-8 text-sm text-slate-500">Nenhum membro vinculado a esta obra.</p>}
        </div>
        {perfil === "diretor" && availableMembers.length > 0 && (
          <WorkMemberForm
            workId={work.id}
            members={availableMembers.map((member) => {
              const profile = profileById.get(member.usuario_id);
              return {
                userId: member.usuario_id,
                label: `${profile?.nome ?? profile?.email ?? member.usuario_id} · ${member.perfil}`,
              };
            })}
          />
        )}
        {perfil === "diretor" && availableMembers.length === 0 && (
          <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:px-7">
            Adicione pessoas em <Link href="/app/membros" className="font-semibold text-emerald-800 hover:underline">Membros da empresa</Link> para vinculá-las a esta obra.
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-900">
        <CalendarDays size={16} className="shrink-0" />
        O cronograma exibido é uma referência linear entre as datas da obra. O cronograma detalhado por EAP será disponibilizado em breve.
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-base font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  percent,
  accent = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  percent?: number;
  accent?: "slate" | "emerald" | "amber" | "rose";
}) {
  const bar = accent === "emerald" ? "bg-emerald-600" : accent === "amber" ? "bg-amber-500" : accent === "rose" ? "bg-rose-600" : "bg-slate-300";
  const valueColor = accent === "emerald" ? "text-emerald-800" : accent === "amber" ? "text-amber-800" : accent === "rose" ? "text-rose-800" : "text-slate-900";
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white p-5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-3 break-words text-lg font-bold leading-tight tracking-tight sm:text-xl ${valueColor}`}>{value}</p>
      {percent !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }} />
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">{detail}</p>
    </article>
  );
}
