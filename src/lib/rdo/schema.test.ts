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
    if (result.success) {
      expect(result.data.mao_obra).toHaveLength(1);
      expect(result.data.producao[0]).not.toHaveProperty("servico_busca");
    }
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

  it("exige seleção efetiva de serviço da EAP", () => {
    const result = rdoPayloadSchema.safeParse({
      clima_manha: null,
      clima_tarde: null,
      observacoes: "",
      mao_obra: [],
      producao: [
        { eap_item_id: "", servico_busca: "1.1 — Serviço digitado", quantidade: 1, observacao: "" },
      ],
      equipamentos: [],
      materiais: [],
      ocorrencias: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["producao", 0, "eap_item_id"]);
      expect(result.error.issues[0]?.message).toBe("Selecione um serviço da lista.");
    }
  });

  it("associa ocorrência incompleta ao campo que está faltando", () => {
    const result = rdoPayloadSchema.safeParse({
      clima_manha: null,
      clima_tarde: null,
      observacoes: "",
      mao_obra: [],
      producao: [],
      equipamentos: [],
      materiais: [],
      ocorrencias: [{ tipo: "", descricao: "Acesso bloqueado", hora_inicio: "", hora_fim: "" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["ocorrencias", 0, "tipo"]);
      expect(result.error.issues[0]?.message).toBe("Informe o tipo da ocorrência.");
    }
  });
});

describe("saldo de serviço", () => {
  it("subtrai a produção acumulada do orçamento", () => {
    expect(calcularSaldo(12, 7.5)).toBe(4.5);
    expect(calcularSaldo(12, 14)).toBe(-2);
  });
});
