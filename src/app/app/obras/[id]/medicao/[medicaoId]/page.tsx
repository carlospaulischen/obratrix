import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { getCompanyContext } from "@/lib/company";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export default async function MedicaoDetailPage({
  params,
}: {
  params: Promise<{ id: string; medicaoId: string }>;
}) {
  const { id, medicaoId } = await params;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,valor_contrato")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const [{ data: canViewCosts }, { data: medicao }] = await Promise.all([
    supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: work.id }),
    supabase
      .from("obx_medicoes")
      .select("id,numero,periodo_inicio,periodo_fim,created_at")
      .eq("id", medicaoId)
      .eq("obra_id", work.id)
      .maybeSingle(),
  ]);
  if (!medicao) notFound();

  const { data: itens } = await supabase
    .from("obx_medicao_itens")
    .select("id,eap_item_id,quantidade,valor")
    .eq("medicao_id", medicao.id);

  const eapIds = (itens ?? []).map((item) => item.eap_item_id);
  const [{ data: servicos }, { data: producaoAnterior }] = await Promise.all([
    eapIds.length
      ? supabase
          .from("obx_eap_itens")
          .select("id,codigo,descricao,unidade,quantidade,custo_unitario")
          .in("id", eapIds)
      : Promise.resolve({ data: [] }),
    eapIds.length
      ? supabase
          .from("obx_rdo_producao")
          .select("eap_item_id,quantidade,obx_rdos!inner(data,status,obra_id)")
          .in("eap_item_id", eapIds)
          .eq("obx_rdos.obra_id", work.id)
          .eq("obx_rdos.status", "confirmado")
          .lte("obx_rdos.data", medicao.periodo_fim)
      : Promise.resolve({ data: [] }),
  ]);

  const servicoPorId = new Map((servicos ?? []).map((s) => [s.id, s]));
  const acumuladoPorItem = new Map<string, number>();
  for (const linha of producaoAnterior ?? []) {
    acumuladoPorItem.set(linha.eap_item_id, (acumuladoPorItem.get(linha.eap_item_id) ?? 0) + Number(linha.quantidade));
  }

  const linhas = (itens ?? [])
    .map((item) => {
      const servico = servicoPorId.get(item.eap_item_id);
      const acumulado = acumuladoPorItem.get(item.eap_item_id) ?? 0;
      const orcadoQtd = Number(servico?.quantidade ?? 0);
      return {
        id: item.id,
        codigo: servico?.codigo ?? "—",
        descricao: servico?.descricao ?? "Serviço removido",
        unidade: servico?.unidade ?? "",
        quantidade: Number(item.quantidade),
        valor: Number(item.valor),
        acumulado,
        acumuladoPct: orcadoQtd > 0 ? acumulado / orcadoQtd : 0,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));

  const totalMedido = linhas.reduce((sum, linha) => sum + linha.valor, 0);
  const contrato = Number(work.valor_contrato ?? 0);

  return (
    <div className="min-w-0 space-y-7">
      <Link
        href={`/app/obras/${work.id}/medicao`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800"
      >
        <ArrowLeft size={14} /> Medições
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Medição nº {medicao.numero}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{work.codigo} · {work.nome}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Período: {formatDate(medicao.periodo_inicio, company.locale)} – {formatDate(medicao.periodo_fim, company.locale)}
        </p>
      </div>

      <WorkTabs workId={work.id} active="medicao" showCosts={Boolean(canViewCosts)} />

      <section className={`grid gap-4 ${canViewCosts ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
        {canViewCosts && (
          <article className="rounded-2xl border border-slate-200/70 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500">Total medido no período</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalMedido, company.locale, company.moeda)}</p>
            {contrato > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {(totalMedido / contrato * 100).toLocaleString(company.locale, { maximumFractionDigits: 1 })}% do contrato
              </p>
            )}
          </article>
        )}
        <article className="rounded-2xl border border-slate-200/70 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">Serviços medidos</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{linhas.length}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">Itens medidos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Serviço</th>
                <th className="px-5 py-3 text-right">Qtd. período</th>
                <th className="px-5 py-3 text-right">Acumulado</th>
                {canViewCosts && <th className="px-5 py-3 text-right">Valor período</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((linha) => (
                <tr key={linha.id}>
                  <td className="px-5 py-3">
                    <strong className="text-slate-800">{linha.codigo}</strong>
                    <span className="ml-2 text-slate-600">{linha.descricao}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">
                    {formatNumber(linha.quantidade, company.locale)} {linha.unidade}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {formatNumber(linha.acumulado, company.locale)} {linha.unidade}
                    <span className="ml-1 text-xs text-slate-400">
                      ({(linha.acumuladoPct * 100).toLocaleString(company.locale, { maximumFractionDigits: 0 })}%)
                    </span>
                  </td>
                  {canViewCosts && (
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(linha.valor, company.locale, company.moeda)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!linhas.length && (
          <p className="px-5 py-8 text-sm text-slate-500">Nenhuma produção confirmada neste período.</p>
        )}
      </section>
    </div>
  );
}
