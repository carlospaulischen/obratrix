import type { Indicadores } from "./calcular";
import { formatCurrency, formatNumber } from "../format";

export type RegraAlerta = {
  idcAtencao: number;
  idcCritico: number;
  idpAtencao: number;
  idpCritico: number;
  eacAtencao: number;
  eacCritico: number;
  diasSemRdo: number;
  diasRascunho: number;
  quedaEV: number;
  semanasMediaEV: number;
  alertasServico: number;
};

export const REGRAS_PADRAO: RegraAlerta = {
  idcAtencao: 0.95,
  idcCritico: 0.85,
  idpAtencao: 0.95,
  idpCritico: 0.85,
  eacAtencao: 1.05,
  eacCritico: 1.15,
  diasSemRdo: 3,
  diasRascunho: 2,
  quedaEV: 0.7,
  semanasMediaEV: 4,
  alertasServico: 5,
};
export type Alerta = { id: string; severidade: "critico" | "atencao"; titulo: string; detalhe: string; link: string };

export type DadosAlertas = Indicadores & {
  obraId: string;
  status: string;
  rdos: readonly { id: string; data: string; status: "rascunho" | "confirmado" }[];
  producaoAcima?: readonly { id: string; codigo: string; quantidadeExecutada: number; quantidadeOrcada: number }[];
  semanasEV?: readonly { semana: string; valor: number }[];
};

export function avaliarAlertas(
  dados: DadosAlertas,
  hoje: string,
  regras: RegraAlerta = REGRAS_PADRAO,
  formato: { locale: string; moeda: string } = { locale: "pt-BR", moeda: "BRL" },
): Alerta[] {
  const alerts: Alerta[] = [];
  const add = (id: string, severidade: Alerta["severidade"], titulo: string, detalhe: string, section = "") =>
    alerts.push({ id, severidade, titulo, detalhe, link: `/app/obras/${dados.obraId}${section ? `/${section}` : ""}` });
  if (dados.idc !== null && dados.idc < regras.idcAtencao) add("idc", dados.idc < regras.idcCritico ? "critico" : "atencao", "Custo acima do valor executado", `IDC ${formatNumber(dados.idc, formato.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
  if (dados.idp !== null && dados.idp < regras.idpAtencao) add("idp", dados.idp < regras.idpCritico ? "critico" : "atencao", "Avanço físico abaixo do planejado", `IDP ${formatNumber(dados.idp, formato.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
  const eacRatio = dados.orcado > 0 ? dados.custoFinalPrevisto / dados.orcado : 0;
  if (eacRatio > regras.eacAtencao) {
    const acima = formatNumber((eacRatio - 1) * 100, formato.locale, { maximumFractionDigits: 0 });
    add("eac", eacRatio > regras.eacCritico ? "critico" : "atencao", "Custo final previsto acima do orçamento", `Custo final previsto ${acima}% acima do orçamento.`);
  }
  for (const service of dados.porServico.filter((item) => item.custoReal > item.orcado).sort((a, b) => (b.custoReal - b.orcado) - (a.custoReal - a.orcado)).slice(0, regras.alertasServico)) {
    add(`custo-servico-${service.id}`, "critico", "Custo real acima do orçamento do serviço", `${service.codigo} · desvio de ${formatCurrency(service.custoReal - service.orcado, formato.locale, formato.moeda)}.`, "orcamento");
  }
  for (const service of dados.servicosAtrasados.slice(0, regras.alertasServico)) {
    const [ano, mes, dia] = service.fimPrevisto.split("-");
    add(`atraso-${service.id}`, "atencao", "Serviço atrasado no cronograma", `${service.codigo} · fim previsto ${dia}/${mes}/${ano}, ${formatNumber(service.executadoPct * 100, formato.locale, { maximumFractionDigits: 0 })}% executado.`, "cronograma");
  }
  for (const service of dados.producaoAcima ?? []) {
    add(`producao-${service.id}`, "atencao", "Produção acima da quantidade orçada", `${service.codigo} · ${formatNumber(service.quantidadeExecutada, formato.locale)} de ${formatNumber(service.quantidadeOrcada, formato.locale)}.`, "orcamento");
  }
  if (dados.status === "em_andamento") {
    const dates: string[] = [];
    const cursor = new Date(`${hoje}T00:00:00.000Z`);
    while (dates.length < regras.diasSemRdo) {
      if (cursor.getUTCDay() !== 0) dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    if (!dados.rdos.some((rdo) => rdo.status === "confirmado" && dates.includes(rdo.data))) {
      add("sem-rdo", "atencao", "Sem RDO confirmado nos últimos dias úteis", `Nenhum RDO nos últimos ${regras.diasSemRdo} dias sem domingo.`, "rdo");
    }
  }
  const cutoff = new Date(`${hoje}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - regras.diasRascunho);
  for (const rdo of dados.rdos.filter((item) => item.status === "rascunho" && item.data < cutoff.toISOString().slice(0, 10))) {
    add(`rascunho-${rdo.id}`, "atencao", "RDO antigo ainda em rascunho", `RDO de ${rdo.data} não foi confirmado.`, "rdo");
  }
  const weekly = [...(dados.semanasEV ?? [])].sort((a, b) => a.semana.localeCompare(b.semana));
  const currentWeek = new Date(`${hoje}T00:00:00.000Z`);
  currentWeek.setUTCDate(currentWeek.getUTCDate() - ((currentWeek.getUTCDay() + 6) % 7));
  const lastCompleteWeek = new Date(currentWeek);
  lastCompleteWeek.setUTCDate(lastCompleteWeek.getUTCDate() - 7);
  const priorWeeks = weekly.filter((week) => week.semana < lastCompleteWeek.toISOString().slice(0, 10)).slice(-regras.semanasMediaEV);
  const lastEV = weekly.find((week) => week.semana === lastCompleteWeek.toISOString().slice(0, 10))?.valor ?? 0;
  const average = priorWeeks.length ? priorWeeks.reduce((sum, week) => sum + week.valor, 0) / priorWeeks.length : 0;
  if (priorWeeks.length === regras.semanasMediaEV && average > 0 && lastEV < average * regras.quedaEV) {
    add("queda-producao", "atencao", "Queda de produção semanal", "A produção da última semana completa caiu abaixo de 70% da média anterior.");
  }
  return alerts;
}
