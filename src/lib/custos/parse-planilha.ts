export type LinhaCustoExcel = {
  linha: number;
  valores: readonly unknown[];
};

export type CategoriaCusto =
  | "mao_obra"
  | "material"
  | "equipamento"
  | "servico_terceiro"
  | "indireto";

export type ItemPlanilhaCusto = {
  data: string;
  descricao: string;
  categoria: CategoriaCusto;
  valor: number;
  fornecedor: string | null;
  documento: string | null;
  codigo_eap: string | null;
  centro_custo: string | null;
};

export type ErroPlanilhaCusto = { linha: number; mensagem: string };

export type ResultadoPlanilhaCusto = {
  itens: ItemPlanilhaCusto[];
  erros: ErroPlanilhaCusto[];
};

export type OpcoesParseCustos = {
  servicosEap?: ReadonlySet<string>;
  centrosCusto?: ReadonlySet<string>;
};

const colunas = [
  "data",
  "descricao",
  "categoria",
  "valor",
  "fornecedor",
  "documento",
  "codigo eap",
  "centro de custo",
] as const;

const categorias: Record<string, CategoriaCusto> = {
  mao_obra: "mao_obra",
  "mao de obra": "mao_obra",
  material: "material",
  equipamento: "equipamento",
  servico_terceiro: "servico_terceiro",
  "servico de terceiro": "servico_terceiro",
  "servico de terceiros": "servico_terceiro",
  "servico terceirizado": "servico_terceiro",
  indireto: "indireto",
};

export function normalizarCabecalhoCusto(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

export function parseValorCusto(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  let normalized = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (normalized.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(normalized)) return undefined;
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  } else if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseDataCusto(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    const milliseconds = Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000);
    return new Date(milliseconds).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!brDate && !isoDate) return undefined;
  const [, a, b, c] = brDate ?? isoDate!;
  const year = Number(brDate ? c : a);
  const month = Number(b);
  const day = Number(brDate ? a : c);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return date.toISOString().slice(0, 10);
}

export function parsePlanilhaCustos(
  linhas: readonly LinhaCustoExcel[],
  opcoes: OpcoesParseCustos = {},
): ResultadoPlanilhaCusto {
  const populated = linhas.filter((row) =>
    row.valores.some((value) => value !== null && value !== undefined && String(value).trim() !== "")
  );
  const header = populated[0];
  if (!header) return { itens: [], erros: [{ linha: 1, mensagem: "A planilha está vazia." }] };

  const indices = new Map<string, number>();
  header.valores.forEach((value, index) => {
    const normalized = normalizarCabecalhoCusto(value);
    if (normalized) indices.set(normalized, index);
  });
  const missing = colunas.filter((column) => !indices.has(column));
  if (missing.length) {
    return {
      itens: [],
      erros: [{
        linha: header.linha,
        mensagem: `Cabeçalho obrigatório ausente: ${missing.join(", ")}.`,
      }],
    };
  }

  const valueFor = (row: LinhaCustoExcel, column: typeof colunas[number]) =>
    row.valores[indices.get(column)!];
  const itens: ItemPlanilhaCusto[] = [];
  const erros: ErroPlanilhaCusto[] = [];
  const services = new Set([...(opcoes.servicosEap ?? [])].map((code) => code.trim()));
  const centers = new Set([...(opcoes.centrosCusto ?? [])].map((code) => code.trim().toLocaleUpperCase("pt-BR")));

  for (const row of populated) {
    if (row.linha <= header.linha) continue;
    const description = String(valueFor(row, "descricao") ?? "").trim();
    const rawDate = valueFor(row, "data");
    const rawCategory = normalizarCabecalhoCusto(valueFor(row, "categoria"));
    const category = (Object.entries(categorias).find(([label]) =>
      normalizarCabecalhoCusto(label) === rawCategory
    )?.[1]) ?? (Object.values(categorias).includes(rawCategory as CategoriaCusto)
      ? rawCategory as CategoriaCusto
      : undefined);
    const amount = parseValorCusto(valueFor(row, "valor"));
    const supplier = String(valueFor(row, "fornecedor") ?? "").trim();
    const document = String(valueFor(row, "documento") ?? "").trim();
    const eapCode = String(valueFor(row, "codigo eap") ?? "").trim();
    const centerCode = String(valueFor(row, "centro de custo") ?? "").trim();
    const date = parseDataCusto(rawDate);
    const rowErrors: string[] = [];

    if (!date) rowErrors.push("Data inválida; use dd/mm/aaaa.");
    if (!description) rowErrors.push("Descrição obrigatória.");
    if (!category) rowErrors.push("Categoria inválida.");
    if (amount === undefined || amount <= 0) rowErrors.push("Valor deve ser um número maior que zero.");
    if (eapCode && !services.has(eapCode)) rowErrors.push(`Serviço EAP desconhecido: ${eapCode}.`);
    if (centerCode && !centers.has(centerCode.toLocaleUpperCase("pt-BR"))) {
      rowErrors.push(`Centro de custo desconhecido: ${centerCode}.`);
    }

    for (const mensagem of rowErrors) erros.push({ linha: row.linha, mensagem });
    if (rowErrors.length || !date || !category || amount === undefined) continue;
    itens.push({
      data: date,
      descricao: description,
      categoria: category,
      valor: amount,
      fornecedor: supplier || null,
      documento: document || null,
      codigo_eap: eapCode || null,
      centro_custo: centerCode || null,
    });
  }
  if (populated.length <= 1) erros.push({ linha: header.linha + 1, mensagem: "A planilha não contém lançamentos." });
  return { itens, erros };
}
