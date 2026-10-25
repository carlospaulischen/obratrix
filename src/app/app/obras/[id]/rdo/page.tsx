import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatNumber } from "@/lib/format";
import { dataHoje } from "@/lib/rdo/data";

export default async function WorkRdoListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();
  const { data: canRegister } = await supabase.rpc("obx_fn_pode_registrar_campo", {
    p_obra_id: work.id,
  });

  const { data: rdos } = await supabase
    .from("obx_rdos")
    .select("id,data,status")
    .eq("obra_id", work.id)
    .order("data", { ascending: false });
  const ids = (rdos ?? []).map((rdo) => rdo.id);
  const [{ data: labor }, { data: occurrences }] = ids.length
    ? await Promise.all([
      supabase.from("obx_rdo_mao_obra").select("rdo_id,quantidade").in("rdo_id", ids),
      supabase.from("obx_rdo_ocorrencias").select("rdo_id").in("rdo_id", ids),
    ])
    : [{ data: [] }, { data: [] }];
  const peopleByRdo = new Map<string, number>();
  for (const entry of labor ?? []) {
    peopleByRdo.set(entry.rdo_id, (peopleByRdo.get(entry.rdo_id) ?? 0) + Number(entry.quantidade));
  }
  const occurrencesByRdo = new Map<string, number>();
  for (const entry of occurrences ?? []) {
    occurrencesByRdo.set(entry.rdo_id, (occurrencesByRdo.get(entry.rdo_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <WorkTabs workId={work.id} active="rdo" />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{work.codigo} · Diário de obra</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{work.nome}</h1>
          <p className="mt-2 text-sm text-slate-500">Registros diários, equipe presente e ocorrências.</p>
        </div>
        {canRegister && (
          <Link href={`/app/obras/${work.id}/rdo/${dataHoje()}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white">
            <Plus size={17} /> RDO de hoje
          </Link>
        )}
      </header>

      {rdos?.length ? (
        <div className="space-y-3">
          {rdos.map((rdo) => (
            <Link key={rdo.id} href={`/app/obras/${work.id}/rdo/${rdo.data}`} className="flex min-h-20 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 sm:px-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-emerald-800"><ClipboardList size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{formatDate(rdo.data, company.locale)}</span>
                <span className="mt-1 block text-xs text-slate-500">{formatNumber(peopleByRdo.get(rdo.id) ?? 0, company.locale)} pessoas · {occurrencesByRdo.get(rdo.id) ?? 0} ocorrências</span>
              </span>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${rdo.status === "confirmado" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                {rdo.status === "confirmado" ? "Confirmado" : "Rascunho"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <ClipboardList size={28} className="mx-auto text-slate-400" />
          <h2 className="mt-4 font-bold text-slate-900">Nenhum RDO registrado</h2>
          <p className="mt-2 text-sm text-slate-500">Comece pelo diário de hoje para registrar a produção e as condições da obra.</p>
        </section>
      )}
    </div>
  );
}
