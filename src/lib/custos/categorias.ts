import type { CategoriaCusto } from "./parse-planilha";

export const categoriasCusto: { value: CategoriaCusto; label: string }[] = [
  { value: "mao_obra", label: "Mão de obra" },
  { value: "material", label: "Material" },
  { value: "equipamento", label: "Equipamento" },
  { value: "servico_terceiro", label: "Serviço de terceiros" },
  { value: "indireto", label: "Indireto" },
];

export const categoriaCustoLabel = Object.fromEntries(
  categoriasCusto.map(({ value, label }) => [value, label]),
) as Record<CategoriaCusto, string>;
