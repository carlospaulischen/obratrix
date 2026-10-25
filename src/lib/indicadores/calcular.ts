export type ServicoIndicador = {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  custo_unitario: number;
  custo_total?: number | null;
  centro_custo_id?: string | null;
  inicio_previsto?: string | null;
  fim_previsto?: string | null;
};

export type ProducaoIndicador = {
  eap_item_id: string;
  quantidade: number;
  data: string;
  rdo_status: "rascunho" | "confirmado";
};

export type CustoIndicador = {
  eap_item_id: string | null;
  centro_custo_id: string | null;
  valor: number;
  data: string;
};

export type DadosIndicadores = {
  obraId: string;
  dataInicio: string | null;
  dataFimPrevista: string | null;
  servicos: readonly ServicoIndicador[];
  producoes: readonly ProducaoIndicador[];
  custos: readonly CustoIndicador[];
  centros?: readonly { id: string; nome: string }[];
};

export type Indicadores = {
  orcado: number;
  valorAgregado: number;
  custoReal: number;
  planejadoPct: number;
  valorPlanejado: number;
  temCronogramaServicos: boolean;
  servicosAtrasados: {
    id: string;
    codigo: string;
    descricao: string;
    fimPrevisto: string;
    executadoPct: number;
  }[];
  idc: number | null;
  idp: number | null;
  custoFinalPrevisto: number;
  desvioPrevisto: number;
  porServico: {
    id: string;
    codigo: string;
    descricao: string;
    quantidadeOrcada: number;
    quantidadeExecutada: number;
    orcado: number;
    valorAgregado: number;
    custoReal: number;
    desvio: number;
  }[];
  porCentro: { centroCustoId: string | null; nome: string; orcado: number; valorAgregado: number; custoReal: number }[];
  curvaS: { semana: string; valorPlanejado: number; valorAgregado: number; custoReal: number }[];
};

const dateFromIso = (value: string) => new Date(`${value}T00:00:00.000Z`);
const isoFromDate = (date: Date) => date.toISOString().slice(0, 10);
const startOfMonday = (date: Date) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result;
};

export function calcularIndicadores(dados: DadosIndicadores, hoje: string): Indicadores {
  const confirmedProduction = dados.producoes.filter((row) => row.rdo_status === "confirmado");
  const executed = new Map<string, number>();
  for (const row of confirmedProduction) {
    executed.set(row.eap_item_id, (executed.get(row.eap_item_id) ?? 0) + Number(row.quantidade));
  }
  const costByService = new Map<string, number>();
  const costByCenter = new Map<string, number>();
  for (const cost of dados.custos) {
    if (cost.eap_item_id) costByService.set(cost.eap_item_id, (costByService.get(cost.eap_item_id) ?? 0) + Number(cost.valor));
    const center = cost.centro_custo_id ?? "";
    costByCenter.set(center, (costByCenter.get(center) ?? 0) + Number(cost.valor));
  }

  const porServico = dados.servicos.map((service) => {
    const quantity = Math.max(Number(service.quantidade), 0);
    const unitCost = Number(service.custo_unitario);
    const quantityExecuted = Math.max(executed.get(service.id) ?? 0, 0);
    const orcado = Number(service.custo_total ?? quantity * unitCost);
    const valorAgregado = Math.min(quantityExecuted, quantity) * unitCost;
    const custoReal = costByService.get(service.id) ?? 0;
    return {
      id: service.id,
      codigo: service.codigo,
      descricao: service.descricao,
      quantidadeOrcada: quantity,
      quantidadeExecutada: quantityExecuted,
      orcado,
      valorAgregado,
      custoReal,
      desvio: custoReal - valorAgregado,
    };
  });
  const orcado = porServico.reduce((sum, service) => sum + service.orcado, 0);
  const valorAgregado = porServico.reduce((sum, service) => sum + service.valorAgregado, 0);
  const custoReal = dados.custos.reduce((sum, cost) => sum + Number(cost.valor), 0);
  const temCronogramaServicos = dados.servicos.some((service) => service.inicio_previsto && service.fim_previsto);
  const fracaoDecorrida = (inicio: string | null | undefined, fim: string | null | undefined, referencia: string) => {
    if (!inicio || !fim) return 0;
    const start = dateFromIso(inicio);
    const finish = dateFromIso(fim);
    const ref = dateFromIso(referencia);
    const span = finish.getTime() - start.getTime();
    return span <= 0 ? (ref >= finish ? 1 : 0) : Math.min(1, Math.max(0, (ref.getTime() - start.getTime()) / span));
  };
  const pvServicoAte = (service: ServicoIndicador, referencia: string) => {
    const serviceOrcado = Number(service.custo_total ?? Math.max(Number(service.quantidade), 0) * Number(service.custo_unitario));
    if (service.inicio_previsto && service.fim_previsto) {
      return serviceOrcado * fracaoDecorrida(service.inicio_previsto, service.fim_previsto, referencia);
    }
    return serviceOrcado * fracaoDecorrida(dados.dataInicio, dados.dataFimPrevista, referencia);
  };
  const valorPlanejado = dados.servicos.reduce((sum, service) => sum + pvServicoAte(service, hoje), 0);
  const planejadoPct = orcado > 0 ? Math.min(1, Math.max(0, valorPlanejado / orcado)) : 0;
  const servicosAtrasados = porServico
    .map((service) => {
      const source = dados.servicos.find((entry) => entry.id === service.id);
      return { ...service, fimPrevisto: source?.fim_previsto ?? null };
    })
    .filter((service) => service.fimPrevisto !== null && service.fimPrevisto < hoje && service.quantidadeExecutada < service.quantidadeOrcada)
    .map((service) => ({
      id: service.id,
      codigo: service.codigo,
      descricao: service.descricao,
      fimPrevisto: service.fimPrevisto!,
      executadoPct: service.quantidadeOrcada > 0 ? service.quantidadeExecutada / service.quantidadeOrcada : 0,
    }))
    .sort((a, b) => a.executadoPct - b.executadoPct);
  const idc = custoReal > 0 ? valorAgregado / custoReal : null;
  const idp = valorPlanejado > 0 ? valorAgregado / valorPlanejado : null;
  const custoFinalPrevisto = idc !== null && idc > 0
    ? custoReal + (orcado - valorAgregado) / idc
    : orcado;
  const centerNames = new Map((dados.centros ?? []).map((center) => [center.id, center.nome]));
  const byCenter = new Map<string, { orcado: number; valorAgregado: number; custoReal: number }>();
  const ensure = (key: string) => {
    const existing = byCenter.get(key) ?? { orcado: 0, valorAgregado: 0, custoReal: 0 };
    byCenter.set(key, existing);
    return existing;
  };
  for (const service of porServico) {
    const source = dados.servicos.find((entry) => entry.id === service.id);
    const center = source?.centro_custo_id ?? "";
    const row = ensure(center);
    row.orcado += service.orcado;
    row.valorAgregado += service.valorAgregado;
  }
  for (const [center, value] of costByCenter) ensure(center).custoReal += value;
  const porCentro = [...byCenter].map(([center, values]) => ({
    centroCustoId: center || null,
    nome: center ? centerNames.get(center) ?? "Centro de custo" : "Sem centro",
    ...values,
  }));
  const curvaS: Indicadores["curvaS"] = [];
  if (dados.dataInicio && dateFromIso(dados.dataInicio) <= dateFromIso(hoje)) {
    const productionByService = new Map<string, { data: string; quantidade: number }[]>();
    const groupedProduction = new Map<string, Map<string, number>>();
    for (const row of confirmedProduction) {
      const byDate = groupedProduction.get(row.eap_item_id) ?? new Map<string, number>();
      byDate.set(row.data, (byDate.get(row.data) ?? 0) + Number(row.quantidade));
      groupedProduction.set(row.eap_item_id, byDate);
    }
    for (const [serviceId, byDate] of groupedProduction) {
      productionByService.set(serviceId, [...byDate].map(([data, quantidade]) => ({ data, quantidade })).sort((a, b) => a.data.localeCompare(b.data)));
    }
    const unitCosts = new Map(dados.servicos.map((service) => [service.id, Number(service.custo_unitario)]));
    const first = startOfMonday(dateFromIso(dados.dataInicio));
    const last = startOfMonday(dateFromIso(hoje));
    for (let week = new Date(first); week <= last; week.setUTCDate(week.getUTCDate() + 7)) {
      const start = isoFromDate(week);
      const endDate = new Date(week);
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      const end = isoFromDate(endDate) > hoje ? hoje : isoFromDate(endDate);
      const pvSemana = dados.servicos.reduce((total, service) => total + pvServicoAte(service, end), 0);
      const ev = [...productionByService].reduce((total, [serviceId, rows]) => {
        const quantity = rows.filter((row) => row.data <= end).reduce((sum, row) => sum + row.quantidade, 0);
        const service = porServico.find((item) => item.id === serviceId);
        return total + Math.min(quantity, service?.quantidadeOrcada ?? 0) * (unitCosts.get(serviceId) ?? 0);
      }, 0);
      const ac = dados.custos.filter((cost) => cost.data <= end).reduce((sum, cost) => sum + Number(cost.valor), 0);
      curvaS.push({ semana: start, valorPlanejado: pvSemana, valorAgregado: ev, custoReal: ac });
    }
  }
  return {
    orcado,
    valorAgregado,
    custoReal,
    planejadoPct,
    valorPlanejado,
    temCronogramaServicos,
    servicosAtrasados,
    idc,
    idp,
    custoFinalPrevisto,
    desvioPrevisto: custoFinalPrevisto - orcado,
    porServico,
    porCentro,
    curvaS,
  };
}
