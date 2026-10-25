import { z } from "zod";

const quantidadeNaoNegativa = z.number().finite().nonnegative();
const textoOpcional = z.string().trim();
const identificadorOpcional = z.union([z.string().uuid(), z.literal("")]);

const maoObraSchema = z.object({
  funcao: z.string(),
  quantidade: z.number().int().nonnegative(),
  horas: quantidadeNaoNegativa,
}).superRefine((linha, contexto) => {
  if (linha.funcao.trim() && linha.quantidade < 1) {
    contexto.addIssue({
      code: "custom",
      path: ["quantidade"],
      message: "Informe ao menos uma pessoa.",
    });
  }
});

const producaoSchema = z.object({
  eap_item_id: identificadorOpcional,
  quantidade: quantidadeNaoNegativa,
  observacao: textoOpcional,
}).superRefine((linha, contexto) => {
  if (linha.eap_item_id && linha.quantidade <= 0) {
    contexto.addIssue({
      code: "custom",
      path: ["quantidade"],
      message: "Informe uma quantidade maior que zero.",
    });
  }
});

const equipamentoSchema = z.object({
  equipamento: z.string(),
  horas_trabalhadas: quantidadeNaoNegativa,
  horas_paradas: quantidadeNaoNegativa,
  motivo_parada: textoOpcional,
});

const materialSchema = z.object({
  material: z.string(),
  quantidade: quantidadeNaoNegativa,
  unidade: z.string(),
}).superRefine((linha, contexto) => {
  if (linha.material.trim() && (!linha.unidade.trim() || linha.quantidade <= 0)) {
    contexto.addIssue({
      code: "custom",
      path: ["quantidade"],
      message: "Informe quantidade e unidade do material.",
    });
  }
});

const ocorrenciaSchema = z.object({
  tipo: z.string(),
  descricao: z.string(),
  hora_inicio: z.string(),
  hora_fim: z.string(),
}).superRefine((linha, contexto) => {
  if ((linha.tipo.trim() || linha.descricao.trim()) && (!linha.tipo.trim() || !linha.descricao.trim())) {
    contexto.addIssue({
      code: "custom",
      path: ["descricao"],
      message: "Informe o tipo e a descrição da ocorrência.",
    });
  }
});

export const rdoPayloadSchema = z.object({
  clima_manha: z.enum(["bom", "nublado", "chuva_fraca", "chuva_forte", "impraticavel"]).nullable(),
  clima_tarde: z.enum(["bom", "nublado", "chuva_fraca", "chuva_forte", "impraticavel"]).nullable(),
  observacoes: z.string().max(5000),
  mao_obra: z.array(maoObraSchema),
  producao: z.array(producaoSchema),
  equipamentos: z.array(equipamentoSchema),
  materiais: z.array(materialSchema),
  ocorrencias: z.array(ocorrenciaSchema),
}).transform((payload) => ({
  ...payload,
  mao_obra: payload.mao_obra.filter((linha) => linha.funcao.trim()),
  producao: payload.producao.filter((linha) => linha.eap_item_id),
  equipamentos: payload.equipamentos.filter((linha) => linha.equipamento.trim()),
  materiais: payload.materiais.filter((linha) => linha.material.trim()),
  ocorrencias: payload.ocorrencias.filter((linha) => linha.tipo.trim() && linha.descricao.trim()),
}));

export type RdoPayload = z.output<typeof rdoPayloadSchema>;
export type RdoPayloadForm = z.input<typeof rdoPayloadSchema>;

export function emptyRdoPayload(): RdoPayloadForm {
  return {
    clima_manha: null,
    clima_tarde: null,
    observacoes: "",
    mao_obra: [],
    producao: [],
    equipamentos: [],
    materiais: [],
    ocorrencias: [],
  };
}
