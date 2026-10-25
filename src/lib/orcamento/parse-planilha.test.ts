import { describe, expect, it } from "vitest";
import { construirArvoreEap, percentualExecutadoEap } from "./arvore";
import {
  compareCodigoNatural,
  parsePlanilha,
  type LinhaExcel,
} from "./parse-planilha";

const cabecalho = [
  "Código",
  "Descrição",
  "Unidade",
  "Quantidade",
  "Custo unitário",
  "Centro de custo",
];

function linha(linha: number, ...valores: unknown[]): LinhaExcel {
  return { linha, valores };
}

describe("parsePlanilha", () => {
  it("infere etapas e serviços em uma hierarquia de três níveis", () => {
    const result = parsePlanilha([
      linha(1, ...cabecalho),
      linha(2, "1", "Fundação", "", "", ""),
      linha(3, "1.2", "Blocos", "", "", ""),
      linha(4, "1.2.1", "Concreto", "m³", 12, 850),
    ], { modo: "substituir" });

    expect(result.erros).toEqual([]);
    expect(result.itens.map(({ codigo, parent_codigo, tipo }) => ({
      codigo,
      parent_codigo,
      tipo,
    }))).toEqual([
      { codigo: "1", parent_codigo: null, tipo: "etapa" },
      { codigo: "1.2", parent_codigo: "1", tipo: "etapa" },
      { codigo: "1.2.1", parent_codigo: "1.2", tipo: "servico" },
    ]);
  });

  it("converte moeda em formato brasileiro para número", () => {
    const result = parsePlanilha([
      linha(1, ...cabecalho),
      linha(2, "1", "Concreto", "m³", "12,5", "R$ 1.234,56"),
    ], { modo: "substituir" });

    expect(result.erros).toEqual([]);
    expect(result.itens[0]?.custo_unitario).toBe(1234.56);
    expect(result.itens[0]?.quantidade).toBe(12.5);
  });

  it("lê datas do cronograma nas colunas opcionais e valida o intervalo", () => {
    const cabecalhoComDatas = [...cabecalho, "Início previsto", "Fim previsto"];
    const result = parsePlanilha([
      linha(1, ...cabecalhoComDatas),
      linha(2, "1", "Fundação", "", "", "", "", "", ""),
      linha(3, "1.1", "Concreto", "m³", 12, 850, "", "22/07/2026", "17/08/2026"),
      linha(4, "1.2", "Blocos", "m²", 20, 90, "", "2026-08-24", ""),
    ], { modo: "substituir" });

    expect(result.erros).toEqual([]);
    expect(result.itens.find((item) => item.codigo === "1.1")).toMatchObject({
      inicio_previsto: "2026-07-22",
      fim_previsto: "2026-08-17",
    });
    expect(result.itens.find((item) => item.codigo === "1.2")).toMatchObject({
      inicio_previsto: "2026-08-24",
      fim_previsto: null,
    });

    const comErro = parsePlanilha([
      linha(1, ...cabecalhoComDatas),
      linha(2, "1", "Fundação", "", "", "", "", "", ""),
      linha(3, "1.1", "Concreto", "m³", 12, 850, "", "20/08/2026", "10/08/2026"),
      linha(4, "1.2", "Blocos", "m²", 20, 90, "", "data errada", ""),
    ], { modo: "substituir" });
    expect(comErro.itens.map((item) => item.codigo)).toEqual(["1"]);
    expect(comErro.erros.map((erro) => erro.mensagem)).toEqual([
      "Fim previsto não pode ser antes do início previsto.",
      "Início previsto inválido. Use dd/mm/aaaa ou aaaa-mm-dd.",
    ]);
  });

  it("retorna erro quando o pai não está na planilha ou na obra", () => {
    const result = parsePlanilha([
      linha(1, ...cabecalho),
      linha(2, "1.2.1", "Concreto", "m³", 12, 850),
    ], { modo: "substituir" });

    expect(result.itens).toEqual([]);
    expect(result.erros).toContainEqual({
      linha: 2,
      mensagem: "Etapa pai 1.2 não encontrada.",
    });
  });

  it("detecta códigos duplicados", () => {
    const result = parsePlanilha([
      linha(1, ...cabecalho),
      linha(2, "1", "Fundação", "", "", ""),
      linha(3, "1", "Outra fundação", "", "", ""),
    ], { modo: "substituir" });

    expect(result.erros).toContainEqual({
      linha: 3,
      mensagem: "Código duplicado: 1.",
    });
  });

  it("exige unidade em serviço", () => {
    const result = parsePlanilha([
      linha(1, ...cabecalho),
      linha(2, "1", "Concreto", "", 12, 850),
    ], { modo: "substituir" });

    expect(result.erros).toContainEqual({
      linha: 2,
      mensagem: "Serviço precisa informar uma unidade.",
    });
  });

  it("permite resolver pai que já existe no modo mesclar", () => {
    const result = parsePlanilha([
      linha(1, ...cabecalho),
      linha(2, "1.2", "Concreto", "m³", 12, 850),
    ], {
      modo: "mesclar",
      codigosExistentes: new Set(["1"]),
    });

    expect(result.erros).toEqual([]);
    expect(result.itens[0]?.parent_codigo).toBe("1");
  });
});

describe("árvore da EAP", () => {
  it("ordena códigos naturalmente", () => {
    expect(["1.10", "1.2", "1.1"].sort(compareCodigoNatural)).toEqual([
      "1.1",
      "1.2",
      "1.10",
    ]);
  });

  it("soma recursivamente os serviços no total das etapas", () => {
    const tree = construirArvoreEap([
      {
        id: "stage-1",
        codigo: "1",
        parent_id: null,
        tipo: "etapa",
        quantidade: 0,
        custo_unitario: 0,
        executado: 0,
      },
      {
        id: "stage-1-2",
        codigo: "1.2",
        parent_id: "stage-1",
        tipo: "etapa",
        quantidade: 0,
        custo_unitario: 0,
        executado: 0,
      },
      {
        id: "service-1",
        codigo: "1.2.1",
        parent_id: "stage-1-2",
        tipo: "servico",
        quantidade: 2,
        custo_unitario: 100,
        custo_total: 200,
        executado: 1,
      },
      {
        id: "service-2",
        codigo: "1.2.2",
        parent_id: "stage-1-2",
        tipo: "servico",
        quantidade: 3,
        custo_unitario: 50,
        custo_total: 150,
        executado: 3,
      },
    ]);

    expect(tree[0]?.totalOrcado).toBe(350);
    expect(tree[0]?.filhos[0]?.totalOrcado).toBe(350);
    expect(tree[0]?.valorExecutado).toBe(250);
    expect(percentualExecutadoEap(tree[0]!)).toBeCloseTo((250 / 350) * 100);
  });
});
