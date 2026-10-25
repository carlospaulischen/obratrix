import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CircleDollarSign, HardHat, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCompanyContext } from "@/lib/company";
import { formatCurrency, formatDate } from "@/lib/format";

const statusText: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  paralisada: "Paralisada",
  concluida: "Concluída",
};

export default async function DashboardPage() {
  const { supabase, company, perfil } = await getCompanyContext();
  const { data: works } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cliente,data_inicio,data_fim_prevista,valor_contrato,status,cidade,uf")
    .eq("empresa_id", company.id)
    .order("updated_at", { ascending: false })
    .limit(4);
  const { data: summary } = await supabase
    .from("obx_vw_obra_resumo")
    .select("custo_realizado")
    .in("obra_id", (works ?? []).map((work) => work.id));
  const contractTotal = (works ?? []).reduce((total, work) => total + Number(work.valor_contrato ?? 0), 0);
  const costTotal = (summary ?? []).reduce((total, row) => total + Number(row.custo_realizado ?? 0), 0);

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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Obras ativas", value: String((works ?? []).filter((work) => work.status === "em_andamento").length).padStart(2, "0"), note: "em andamento", icon: BriefcaseBusiness, tint: "bg-emerald-50 text-emerald-800" },
          { label: "Valor contratado", value: formatCurrency(contractTotal, company.locale, company.moeda), note: "nas obras exibidas", icon: CircleDollarSign, tint: "bg-blue-50 text-blue-700" },
          { label: "Custos registrados", value: formatCurrency(costTotal, company.locale, company.moeda), note: "acumulado", icon: TrendingUp, tint: "bg-amber-50 text-amber-700" },
          { label: "Equipe em campo", value: "—", note: "registros de hoje", icon: HardHat, tint: "bg-violet-50 text-violet-700" },
        ].map(({ label, value, note, icon: Icon, tint }) => (
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
            <h2 className="font-bold text-slate-900">Obras recentes</h2>
            <p className="mt-1 text-xs text-slate-500">Acompanhe os projetos da empresa</p>
          </div>
          <Link href="/app/obras" className="flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline">
            Ver todas <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {(works ?? []).map((work) => (
            <Link key={work.id} href={`/app/obras/${work.id}`} className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><BriefcaseBusiness size={19} /></div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{work.nome}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{work.cliente ?? "Cliente não informado"} · {work.codigo}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-8 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="text-xs font-semibold text-slate-800">{formatCurrency(work.valor_contrato, company.locale, company.moeda)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Entrega prevista · {formatDate(work.data_fim_prevista, company.locale)}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${work.status === "em_andamento" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                  {statusText[work.status] ?? work.status}
                </span>
              </div>
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
    </div>
  );
}
