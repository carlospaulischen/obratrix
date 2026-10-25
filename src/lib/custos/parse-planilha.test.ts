import { describe, expect, it } from "vitest";
import {
  parseDataCusto,
  parsePlanilhaCustos,
  parseValorCusto,
  type LinhaCustoExcel,
} from "./parse-planilha";

const header = [
  "DATA",
  "Descrição",
  "Categoria",
  "Valor",
  "Fornecedor",
  "Documento",
  "Código EAP",
  "Centro de custo",
];

function row(linha: number, ...valores: unknown[]): LinhaCustoExcel {
  return { linha, valores };
}

describe("parser de planilha de custos", () => {
  it("reconhece cabeçalhos sem diferenciar acentos e maiúsculas", () => {
    const result = parsePlanilhaCustos([
      row(1, "DATA", "DESCRICAO", "CATEGORIA", "VALOR", "FORNECEDOR", "DOCUMENTO", "CODIGO EAP", "CENTRO DE CUSTO"),
      row(2, "25/10/2026", "Compra de aço", "Material", 1234.56, "Aço Brasil", "NF-10", "1.1", "FND"),
    ], {
      servicosEap: new Set(["1.1"]),
      centrosCusto: new Set(["FND"]),
    });

    expect(result.erros).toEqual([]);
    expect(result.itens).toEqual([{
      data: "2026-10-25",
      descricao: "Compra de aço",
      categoria: "material",
      valor: 1234.56,
      fornecedor: "Aço Brasil",
      documento: "NF-10",
      codigo_eap: "1.1",
      centro_custo: "FND",
    }]);
  });

  it("converte valor monetário brasileiro", () => {
    expect(parseValorCusto("R$ 1.234,56")).toBe(1234.56);
    expect(parseValorCusto("12,5")).toBe(12.5);
    expect(parseValorCusto(48.75)).toBe(48.75);
  });

  it("converte datas pt-BR, nativas e seriais do Excel", () => {
    expect(parseDataCusto("25/10/2026")).toBe("2026-10-25");
    expect(parseDataCusto(new Date("2026-10-25T00:00:00.000Z"))).toBe("2026-10-25");
    const serial = (Date.UTC(2026, 9, 25) - Date.UTC(1899, 11, 30)) / 86_400_000;
    expect(parseDataCusto(serial)).toBe("2026-10-25");
    expect(parseDataCusto("31/02/2026")).toBeUndefined();
  });

  it("lista erros por linha para dados inválidos e referências desconhecidas", () => {
    const result = parsePlanilhaCustos([
      row(1, ...header),
      row(2, "25/10/2026", "", "material", -1, "", "", "9.9", "XYZ"),
    ], { servicosEap: new Set(["1.1"]), centrosCusto: new Set(["FND"]) });

    expect(result.itens).toEqual([]);
    expect(result.erros.map((error) => error.mensagem)).toEqual([
      "Descrição obrigatória.",
      "Valor deve ser um número maior que zero.",
      "Serviço EAP desconhecido: 9.9.",
      "Centro de custo desconhecido: XYZ.",
    ]);
    expect(result.erros.every((error) => error.linha === 2)).toBe(true);
  });

  it("aceita rótulos em português e valores do enum", () => {
    const result = parsePlanilhaCustos([
      row(1, ...header),
      row(2, "25/10/2026", "Equipe", "Mão de obra", 100, "", "", "", ""),
      row(3, "25/10/2026", "Locação", "servico_terceiro", 200, "", "", "", ""),
    ]);

    expect(result.erros).toEqual([]);
    expect(result.itens.map((item) => item.categoria)).toEqual(["mao_obra", "servico_terceiro"]);
  });
});
