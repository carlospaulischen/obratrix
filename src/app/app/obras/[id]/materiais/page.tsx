import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatNumber } from "@/lib/format";

export default async function MateriaisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inicio?: string; fim?: string }>;
}) {
  const { id } = await params;
  const { inicio, fim } = await searchParams;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const { data: canViewCosts } = await supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: work.id });

  let query = supabase
    .from("obx_rdo_materiais")
    .select("id,material,quantidade,unidade,obx_rdos!inner(data,obra_id)")
    .eq("obx_rdos.obra_id", work.id)
    .order("id");
  const dataValida = (valor?: string) => valor && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  if (dataValida(inicio)) query = query.gte("obx_rdos.data", inicio!);
  if (dataValida(fim)) query = query.lte("obx_rdos.data", fim!);
  const { data: linhas } = await query;

  const entradas = (linhas ?? [])
    .map((linha) => ({
      id: linha.id,
      material: linha.material,
      quantidade: Number(linha.quantidade),
      unidade: linha.unidade ?? "",
      data: (linha.obx_rdos as unknown as { data: string }).data,
    }))
    .sort((a, b) => b.data.localeCompare(a.data));

  const totais = new Map<string, { material: string; unidade: string; quantidade: number }>();
  for (const entrada of entradas) {
    const chave = `${entrada.material.trim().toLowerCase()}|${entrada.unidade.trim().toLowerCase()}`;
    const atual = totais.get(chave) ?? {
      material: entrada.material,
      unidade: entrada.unidade,
      quantidade: 0,
    };
    atual.quantidade += entrada.quantidade;
    totais.set(chave, atual);
  }
  const totaisOrdenados = Array.from(totais.values())
    .sort((a, b) => b.quantidade - a.quantidade);

  const inputClass =
    "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none";

  return (
    <div className="min-w-0 space-y-7">
      <Link href="/app/obras" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800">
        <ArrowLeft size={14} /> Obras
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{work.codigo} · {work.nome}</h1>
        <p className="mt-1 text-sm text-slate-500">Livro de entrada de materiais registrados nos RDOs.</p>
      </div>

      <WorkTabs workId={work.id} active="materiais" showCosts={Boolean(canViewCosts)} />

      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="space-y-1 text-xs font-semibold text-slate-500">
          De
          <input type="date" name="inicio" defaultValue={inicio} className={`${inputClass} block`} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-500">
          Até
          <input type="date" name="fim" defaultValue={fim} className={`${inputClass} block`} />
        </label>
        <button type="submit" className="min-h-10 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
          Filtrar
        </button>
      </form>

      {totaisOrdenados.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {totaisOrdenados.slice(0, 6).map((total) => (
            <article key={`${total.material}|${total.unidade}`} className="rounded-2xl border border-slate-200/70 bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Package size={14} className="text-emerald-700" /> {total.material}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatNumber(total.quantidade, company.locale)} <span className="text-sm font-semibold text-slate-500">{total.unidade}</span>
              </p>
            </article>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">Entradas por dia</h2>
          <p className="mt-1 text-xs text-slate-500">{entradas.length} registro(s) de materiais.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Material</th>
                <th className="px-5 py-3 text-right">Quantidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entradas.map((entrada) => (
                <tr key={entrada.id}>
                  <td className="px-5 py-3 text-slate-600">{formatDate(entrada.data, company.locale)}</td>
                  <td className="px-5 py-3 font-medium text-slate-800">{entrada.material}</td>
                  <td className="px-5 py-3 text-right text-slate-800">
                    {formatNumber(entrada.quantidade, company.locale)} {entrada.unidade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entradas.length && (
          <p className="px-5 py-8 text-sm text-slate-500">Nenhum material registrado no período.</p>
        )}
      </section>
    </div>
  );
}
