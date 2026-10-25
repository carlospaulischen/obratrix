import type { SupabaseClient } from "@supabase/supabase-js";
import { avaliarAlertas } from "./alertas";
import { calcularIndicadores } from "./calcular";

async function carregarTodasAsPaginas<T>(
  buscar: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await buscar(inicio, inicio + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function carregarIndicadoresObras(
  supabase: SupabaseClient,
  works: readonly {
    id: string;
    codigo: string;
    nome: string;
    status: string;
    data_inicio: string | null;
    data_fim_prevista: string | null;
  }[],
  hoje: string,
  centrosEmpresaId: string,
  formato: { locale: string; moeda: string },
) {
  const ids = works.map((work) => work.id);
  if (!ids.length) return [];
  const [services, rdos, costs, centers] = await Promise.all([
    carregarTodasAsPaginas((inicio, fim) => supabase.from("obx_eap_itens").select("id,obra_id,codigo,descricao,quantidade,custo_unitario,custo_total,centro_custo_id").eq("tipo", "servico").in("obra_id", ids).order("id").range(inicio, fim)),
    carregarTodasAsPaginas((inicio, fim) => supabase.from("obx_rdos").select("id,obra_id,data,status").in("obra_id", ids).order("id").range(inicio, fim)),
    carregarTodasAsPaginas((inicio, fim) => supabase.from("obx_custos").select("obra_id,data,valor,eap_item_id,centro_custo_id").in("obra_id", ids).order("id").range(inicio, fim)),
    carregarTodasAsPaginas((inicio, fim) => supabase.from("obx_centros_custo").select("id,nome").eq("empresa_id", centrosEmpresaId).order("id").range(inicio, fim)),
  ]);
  const rdoIds = (rdos ?? []).map((rdo) => rdo.id);
  const production = (await Promise.all(
    Array.from({ length: Math.ceil(rdoIds.length / 50) }, (_, index) => {
      const ids = rdoIds.slice(index * 50, (index + 1) * 50);
      return carregarTodasAsPaginas((inicio, fim) => supabase.from("obx_rdo_producao").select("id,rdo_id,eap_item_id,quantidade").in("rdo_id", ids).order("id").range(inicio, fim));
    }),
  )).flat();
  const rdoById = new Map(rdos.map((rdo) => [rdo.id, rdo]));
  return works.map((work) => {
    const obraRdos = rdos.filter((rdo) => rdo.obra_id === work.id);
    const obraServices = services.filter((item) => item.obra_id === work.id);
    const obraProductions = production.flatMap((item) => {
      const rdo = rdoById.get(item.rdo_id);
      return rdo?.obra_id === work.id
        ? [{ eap_item_id: item.eap_item_id, quantidade: Number(item.quantidade), data: rdo.data, rdo_status: rdo.status }]
        : [];
    });
    const obraCosts = costs.filter((item) => item.obra_id === work.id)
      .map((item) => ({ ...item, valor: Number(item.valor) }));
    const indicators = calcularIndicadores({
      obraId: work.id,
      dataInicio: work.data_inicio,
      dataFimPrevista: work.data_fim_prevista,
      servicos: obraServices,
      producoes: obraProductions,
      custos: obraCosts,
      centros: centers,
    }, hoje);
    const weeklyEV = indicators.curvaS.map((point, index, all) => ({
      semana: point.semana,
      valor: point.valorAgregado - (all[index - 1]?.valorAgregado ?? 0),
    }));
    const producaoAcima = indicators.porServico
      .filter((item) => item.quantidadeExecutada > item.quantidadeOrcada)
      .map(({ id, codigo, quantidadeExecutada, quantidadeOrcada }) => ({ id, codigo, quantidadeExecutada, quantidadeOrcada }));
    const alerts = avaliarAlertas({
      ...indicators,
      obraId: work.id,
      status: work.status,
      rdos: obraRdos,
      producaoAcima,
      semanasEV: weeklyEV,
    }, hoje, undefined, formato);
    return { work, indicadores: indicators, alertas: alerts };
  });
}
