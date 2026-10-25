import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, ClipboardList } from "lucide-react";
import { getCompanyContext } from "@/lib/company";
import { dataHoje } from "@/lib/rdo/data";

export default async function FieldTodayPage() {
  const { supabase, company } = await getCompanyContext();
  const today = dataHoje(company.fuso_horario);
  const { data: works } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cidade,uf")
    .eq("empresa_id", company.id)
    .order("nome");
  const permitted = await Promise.all((works ?? []).map(async (work) => {
    const { data } = await supabase.rpc("obx_fn_pode_registrar_campo", { p_obra_id: work.id });
    return data ? work : null;
  }));
  const fieldWorks = permitted.filter((work): work is NonNullable<typeof work> => Boolean(work));
  if (fieldWorks.length === 1) redirect(`/app/obras/${fieldWorks[0]!.id}/rdo/${today}`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Registro de campo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Hoje</h1>
        <p className="mt-2 text-sm text-slate-500">Escolha a obra para abrir o diário do dia {today}.</p>
      </header>
      {fieldWorks.length ? (
        <div className="space-y-3">
          {fieldWorks.map((work) => (
            <Link key={work.id} href={`/app/obras/${work.id}/rdo/${today}`} className="flex min-h-20 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><BriefcaseBusiness size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{work.codigo}</span>
                <span className="mt-1 block truncate text-base font-bold text-slate-900">{work.nome}</span>
                <span className="mt-1 block text-xs text-slate-500">{[work.cidade, work.uf].filter(Boolean).join(" · ") || "Local não informado"}</span>
              </span>
              <ClipboardList size={18} className="shrink-0 text-emerald-800" />
            </Link>
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <ClipboardList size={26} className="mx-auto text-slate-400" />
          <h2 className="mt-4 font-bold text-slate-900">Nenhuma obra disponível para registro</h2>
          <p className="mt-2 text-sm text-slate-500">Peça ao diretor para vincular seu perfil a uma obra.</p>
        </section>
      )}
    </div>
  );
}
