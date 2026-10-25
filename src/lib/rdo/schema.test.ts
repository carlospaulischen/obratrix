import { describe, expect, it } from "vitest";
import { rdoPayloadSchema } from "./schema";
import { calcularSaldo } from "./saldo";

describe("payload do RDO", () => {
  it("valida os campos e remove linhas vazias", () => {
    const result = rdoPayloadSchema.safeParse({
      clima_manha: "bom",
      clima_tarde: null,
      observacoes: "Concretagem liberada.",
      mao_obra: [
        { funcao: "Pedreiro", quantidade: 2, horas: 8 },
        { funcao: "", quantidade: 0, horas: 0 },
      ],
      producao: [
        { eap_item_id: "c6a5bdac-607e-475d-86ce-8bcfd433d83e", quantidade: 5, observacao: "" },
      ],
      equipamentos: [],
      materiais: [],
      ocorrencias: [],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mao_obra).toHaveLength(1);
  });

  it("rejeita produção negativa", () => {
    const result = rdoPayloadSchema.safeParse({
      clima_manha: null,
      clima_tarde: null,
      observacoes: "",
      mao_obra: [],
      producao: [
        { eap_item_id: "c6a5bdac-607e-475d-86ce-8bcfd433d83e", quantidade: -1, observacao: "" },
      ],
      equipamentos: [],
      materiais: [],
      ocorrencias: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("saldo de serviço", () => {
  it("subtrai a produção acumulada do orçamento", () => {
    expect(calcularSaldo(12, 7.5)).toBe(4.5);
    expect(calcularSaldo(12, 14)).toBe(-2);
  });
});
