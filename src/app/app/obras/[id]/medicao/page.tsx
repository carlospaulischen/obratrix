import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCheck } from "lucide-react";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { MedicaoEmitir } from "@/components/medicao/medicao-emitir";
import { getCompanyContext } from "@/lib/company";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function MedicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,valor_contrato")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const [{ data: canViewCosts }, { data: canEdit }, { data: medicoes }] = await Promise.all([
    supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: work.id }),
    supabase.rpc("obx_fn_pode_editar_obra", { p_obra_id: work.id }),
    supabase
      .from("obx_medicoes")
      .select("id,numero,periodo_inicio,periodo_fim,created_at")
      .eq("obra_id", work.id)
      .order("numero", { ascending: false }),
  ]);

  const medicaoIds = (medicoes ?? []).map((m) => m.id);
  const { data: itens } = medicaoIds.length
    ? await supabase.from("obx_medicao_itens").select("medicao_id,valor").in("medicao_id", medicaoIds)
    : { data: [] };
  const totalPorMedicao = new Map<string, number>();
  for (const item of itens ?? []) {
    totalPorMedicao.set(item.medicao_id, (totalPorMedicao.get(item.medicao_id) ?? 0) + Number(item.valor));
  }
  const contrato = Number(work.valor_contrato ?? 0);

  return (
    <div className="min-w-0 space-y-7">
      <Link href="/app/obras" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800">
        <ArrowLeft size={14} /> Obras
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{work.codigo} · {work.nome}</h1>
        <p className="mt-1 text-sm text-slate-500">Medições por período — produção confirmada × valor orçado.</p>
      </div>

      <WorkTabs workId={work.id} active="medicao" showCosts={Boolean(canViewCosts)} />

      {canEdit && (
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
          <h2 className="mb-3 font-bold text-slate-900">Nova medição</h2>
          <MedicaoEmitir workId={work.id} />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200/70 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">Boletins emitidos</h2>
          <p className="mt-1 text-xs text-slate-500">Cada boletim é um snapshot imutável do período.</p>
        </div>
        {!medicoes?.length && (
          <p className="px-5 py-8 text-sm text-slate-500">Nenhuma medição emitida ainda.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {(medicoes ?? []).map((medicao) => {
            const total = totalPorMedicao.get(medicao.id) ?? 0;
            return (
              <li key={medicao.id}>
                <Link
                  href={`/app/obras/${work.id}/medicao/${medicao.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <FileCheck size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm text-slate-800">Medição nº {medicao.numero}</strong>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {formatDate(medicao.periodo_inicio, company.locale)} – {formatDate(medicao.periodo_fim, company.locale)}
                    </span>
                  </span>
                  {canViewCosts && (
                    <span className="text-right">
                      <strong className="block text-sm text-slate-800">{formatCurrency(total, company.locale, company.moeda)}</strong>
                      {contrato > 0 && (
                        <span className="text-xs text-slate-500">
                          {(total / contrato * 100).toLocaleString(company.locale, { maximumFractionDigits: 1 })}% do contrato
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
