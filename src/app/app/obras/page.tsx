import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCompanyContext } from "@/lib/company";
import { formatCurrency, formatDate } from "@/lib/format";

const labels: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  paralisada: "Paralisada",
  concluida: "Concluída",
};

const statusClass: Record<string, string> = {
  planejamento: "bg-blue-50 text-blue-700",
  em_andamento: "bg-emerald-50 text-emerald-800",
  paralisada: "bg-amber-50 text-amber-800",
  concluida: "bg-slate-100 text-slate-600",
};

export default async function WorksPage() {
  const { supabase, company, perfil } = await getCompanyContext();
  const { data: works, error } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cliente,endereco,cidade,uf,data_inicio,data_fim_prevista,valor_contrato,status")
    .eq("empresa_id", company.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Projetos da empresa</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Obras</h1>
          <p className="mt-2 text-sm text-slate-500">Uma visão clara do que está acontecendo em cada frente.</p>
        </div>
        {perfil === "diretor" && (
          <Button asChild><Link href="/app/obras/nova"><Plus size={17} /> Nova obra</Link></Button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <BriefcaseBusiness size={16} />
          <span><strong className="text-slate-800">{works?.length ?? 0}</strong> obras cadastradas</span>
        </div>
        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-400 sm:w-64">
          <Search size={15} />
          <span>Busca em breve</span>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Não foi possível carregar as obras.</p>}
      {works?.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {works.map((work) => (
            <Link key={work.id} href={`/app/obras/${work.id}`} className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_10px_rgba(20,44,32,0.02)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <BriefcaseBusiness size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{work.codigo}</p>
                    <h2 className="mt-1 truncate text-lg font-bold text-slate-900">{work.nome}</h2>
                    <p className="mt-1 truncate text-sm text-slate-500">{work.cliente ?? "Cliente não informado"}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${statusClass[work.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {labels[work.status] ?? work.status}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contrato</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-800">{formatCurrency(work.valor_contrato, company.locale, company.moeda)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Previsão de entrega</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-800">{formatDate(work.data_fim_prevista, company.locale)}</p>
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <p className="truncate text-xs text-slate-500">{[work.cidade, work.uf].filter(Boolean).join(" · ") || "Local não informado"}</p>
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-800 group-hover:gap-2">Ver detalhes <ArrowRight size={14} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><BriefcaseBusiness size={23} /></div>
          <h2 className="mt-5 text-lg font-bold text-slate-900">Nenhuma obra por aqui ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Cadastre a primeira obra para centralizar dados do projeto, equipe e cronograma.</p>
          {perfil === "diretor" && (
            <Button asChild className="mt-6"><Link href="/app/obras/nova"><Plus size={16} /> Cadastrar primeira obra</Link></Button>
          )}
        </section>
      )}
    </div>
  );
}
