import { describe, expect, it } from "vitest";
import { avaliarAlertas } from "./alertas";
import { calcularIndicadores, type DadosIndicadores } from "./calcular";

const base: DadosIndicadores = {
  obraId: "obra-1",
  dataInicio: "2026-10-01",
  dataFimPrevista: "2026-10-31",
  servicos: [{ id: "s1", codigo: "1.1", descricao: "Serviço", quantidade: 10, custo_unitario: 10, centro_custo_id: "c1" }],
  producoes: [{ eap_item_id: "s1", quantidade: 12, data: "2026-10-20", rdo_status: "confirmado" }],
  custos: [{ eap_item_id: "s1", centro_custo_id: "c1", valor: 60, data: "2026-10-20" }],
  centros: [{ id: "c1", nome: "Estrutura" }],
};

describe("indicadores", () => {
  it("retorna null nos índices com denominador zero", () => {
    const result = calcularIndicadores({ ...base, custos: [], dataInicio: null, dataFimPrevista: null }, "2026-10-10");
    expect(result.idc).toBeNull();
    expect(result.idp).toBeNull();
  });

  it("trata obra sem datas como sem valor planejado", () => {
    const result = calcularIndicadores({ ...base, dataInicio: null, dataFimPrevista: null }, "2026-10-10");
    expect(result.planejadoPct).toBe(0);
    expect(result.valorPlanejado).toBe(0);
  });

  it("calcula EAC e desvio previsto", () => {
    const result = calcularIndicadores(base, "2026-10-31");
    expect(result.orcado).toBe(100);
    expect(result.valorAgregado).toBe(100);
    expect(result.custoReal).toBe(60);
    expect(result.custoFinalPrevisto).toBe(60);
    expect(result.desvioPrevisto).toBe(-40);
  });

  it("limita EV à quantidade orçada e cria semanas vazias na curva S", () => {
    const result = calcularIndicadores({
      ...base,
      dataInicio: "2026-09-01",
      producoes: [{ ...base.producoes[0]!, quantidade: 30 }],
    }, "2026-10-31");
    expect(result.valorAgregado).toBe(100);
    expect(result.curvaS.length).toBeGreaterThan(4);
    expect(result.curvaS.some((week) => week.valorAgregado === 0)).toBe(true);
  });
});

describe("alertas por regra", () => {
  it("classifica IDC e IDP nos níveis de atenção e crítico", () => {
    const result = calcularIndicadores(base, "2026-10-15");
    const alerts = avaliarAlertas({ ...result, idc: 0.8, idp: 0.9, obraId: "obra-1", status: "em_andamento", rdos: [] }, "2026-10-20");
    expect(alerts.find((item) => item.id === "idc")?.severidade).toBe("critico");
    expect(alerts.find((item) => item.id === "idp")?.severidade).toBe("atencao");
  });

  it("formata os detalhes financeiros dos alertas com a localidade e moeda da empresa", () => {
    const result = calcularIndicadores({ ...base, custos: [{ ...base.custos[0]!, valor: 150 }] }, "2026-10-31");
    const alerts = avaliarAlertas({
      ...result,
      obraId: "obra-1",
      status: "planejamento",
      rdos: [],
    }, "2026-10-31", undefined, { locale: "pt-BR", moeda: "BRL" });

    expect(alerts.find((item) => item.id === "idc")?.detalhe).toBe("IDC 0,67.");
    expect(alerts.find((item) => item.id === "eac")?.detalhe).toBe("Custo final previsto 50% acima do orçamento.");
    expect(alerts.find((item) => item.id === "custo-servico-s1")?.detalhe?.replace(/\u00a0/g, " ")).toContain("R$ 50,00");
  });

  it("avisa quando o EAC passa de 105% e critica acima de 115% do BAC", () => {
    const attention = calcularIndicadores({ ...base, custos: [{ ...base.custos[0]!, valor: 108 }] }, "2026-10-31");
    const critical = calcularIndicadores({ ...base, custos: [{ ...base.custos[0]!, valor: 200 }] }, "2026-10-31");
    expect(avaliarAlertas({ ...attention, obraId: "obra-1", status: "planejamento", rdos: [] }, "2026-10-31").find((item) => item.id === "eac")?.severidade).toBe("atencao");
    expect(avaliarAlertas({ ...critical, obraId: "obra-1", status: "planejamento", rdos: [] }, "2026-10-31").find((item) => item.id === "eac")?.severidade).toBe("critico");
  });

  it("limita os alertas de serviço acima do orçamento aos cinco maiores desvios", () => {
    const services = Array.from({ length: 7 }, (_, index) => ({
      ...base.servicos[0]!,
      id: `s${index + 1}`,
      codigo: `1.${index + 1}`,
    }));
    const costs = services.map((service) => ({ eap_item_id: service.id, centro_custo_id: "c1", valor: 200, data: "2026-10-20" }));
    const result = calcularIndicadores({ ...base, servicos: services, custos: costs }, "2026-10-31");
    const alerts = avaliarAlertas({
      ...result,
      obraId: "obra-1",
      status: "planejamento",
      rdos: [],
    }, "2026-10-31");
    expect(alerts.filter((item) => item.id.startsWith("custo-servico-"))).toHaveLength(5);
  });

  it("avisa quando a produção passa da quantidade orçada", () => {
    const result = calcularIndicadores(base, "2026-10-31");
    const alerts = avaliarAlertas({
      ...result,
      obraId: "obra-1",
      status: "planejamento",
      rdos: [],
      producaoAcima: [{ id: "s1", codigo: "1.1", quantidadeExecutada: 12, quantidadeOrcada: 10 }],
    }, "2026-10-31");
    expect(alerts.find((item) => item.id === "producao-s1")?.severidade).toBe("atencao");
  });

  it("considera apenas dias úteis ao alertar pela falta de RDO", () => {
    const result = calcularIndicadores(base, "2026-10-31");
    const alerts = avaliarAlertas({
      ...result,
      obraId: "obra-1",
      status: "em_andamento",
      rdos: [{ id: "domingo", data: "2026-10-25", status: "confirmado" }],
    }, "2026-10-26");
    expect(alerts.map((item) => item.id)).toContain("sem-rdo");
  });

  it("alerta para RDO em rascunho com mais de dois dias", () => {
    const result = calcularIndicadores(base, "2026-10-31");
    const alerts = avaliarAlertas({
      ...result,
      obraId: "obra-1",
      status: "planejamento",
      rdos: [{ id: "r1", data: "2026-10-28", status: "rascunho" }],
    }, "2026-10-31");
    expect(alerts.map((item) => item.id)).toContain("rascunho-r1");
  });

  it("alerta quando a última semana completa cai abaixo de 70% da média anterior", () => {
    const result = calcularIndicadores(base, "2026-10-31");
    const alerts = avaliarAlertas({
      ...result,
      obraId: "obra-1",
      status: "planejamento",
      rdos: [],
      semanasEV: [
        { semana: "2026-09-21", valor: 10 },
        { semana: "2026-09-28", valor: 10 },
        { semana: "2026-10-05", valor: 10 },
        { semana: "2026-10-12", valor: 10 },
        { semana: "2026-10-19", valor: 1 },
        { semana: "2026-10-26", valor: 0 },
      ],
    }, "2026-10-31");
    expect(alerts.map((item) => item.id)).toContain("queda-producao");
  });
});
