export type ModoImportacaoEap = "substituir" | "mesclar";

export type LinhaExcel = {
  linha: number;
  valores: readonly unknown[];
};

export type ItemPlanilhaEap = {
  codigo: string;
  parent_codigo: string | null;
  descricao: string;
  tipo: "etapa" | "servico";
  unidade: string | null;
  quantidade: number;
  custo_unitario: number;
  centro_custo_id: string | null;
};

export type ErroPlanilha = {
  linha: number;
  mensagem: string;
};

export type ResultadoPlanilha = {
  itens: ItemPlanilhaEap[];
  erros: ErroPlanilha[];
};

export type OpcoesParsePlanilha = {
  modo: ModoImportacaoEap;
  codigosExistentes?: ReadonlySet<string>;
  centrosCusto?: ReadonlyMap<string, string>;
};

type Candidato = {
  linha: number;
  codigo: string;
  parentCodigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  custoUnitario: number;
  temQuantidade: boolean;
  temCusto: boolean;
  centroCustoId: string | null;
  erros: string[];
};

const collator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

const colunasObrigatorias = [
  "codigo",
  "descricao",
  "unidade",
  "quantidade",
  "custo unitario",
  "centro de custo",
] as const;

type ColunaPlanilha = typeof colunasObrigatorias[number];

export function compareCodigoNatural(a: string, b: string) {
  return collator.compare(a, b);
}

export function normalizarCabecalho(value: unknown) {
  return textoCelula(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

export function parseNumeroPtBr(value: unknown): number | undefined {
  const cell = valorPrimitivo(value);
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : undefined;
  if (typeof cell !== "string" || !cell.trim()) return undefined;

  let normalized = cell.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (normalized.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(normalized)) {
      return undefined;
    }
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  } else if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePlanilha(
  linhas: readonly LinhaExcel[],
  opcoes: OpcoesParsePlanilha,
): ResultadoPlanilha {
  const erros: ErroPlanilha[] = [];
  const linhasPreenchidas = linhas.filter((row) =>
    row.valores.some((value) => !celulaVazia(value))
  );
  const cabecalho = linhasPreenchidas[0];
  if (!cabecalho) {
    return {
      itens: [],
      erros: [{ linha: 1, mensagem: "A planilha está vazia." }],
    };
  }

  const indices = new Map<string, number>();
  cabecalho.valores.forEach((value, index) => {
    const normalized = normalizarCabecalho(value);
    if (normalized) indices.set(normalized, index);
  });
  const colunasAusentes = colunasObrigatorias.filter((column) =>
    !indices.has(column)
  );
  if (colunasAusentes.length) {
    return {
      itens: [],
      erros: [{
        linha: cabecalho.linha,
        mensagem: `Cabeçalho obrigatório ausente: ${colunasAusentes.join(", ")}.`,
      }],
    };
  }

  const getValue = (row: LinhaExcel, column: ColunaPlanilha) =>
    row.valores[indices.get(column)!];
  const candidatos: Candidato[] = [];
  const codigosNaPlanilha = new Set<string>();
  const codigosExistentes = new Set(
    [...(opcoes.codigosExistentes ?? [])].map((code) => code.trim()),
  );
  const centrosPorCodigo = new Map(
    [...(opcoes.centrosCusto ?? [])].map(([code, id]) => [
      normalizarCodigoCentro(code),
      id,
    ]),
  );
  const adicionaErro = (linha: number, mensagem: string) => {
    erros.push({ linha, mensagem });
  };

  for (const row of linhasPreenchidas) {
    if (row.linha <= cabecalho.linha) continue;

    const rowErrors: string[] = [];
    const code = textoCelula(getValue(row, "codigo")).trim();
    const description = textoCelula(getValue(row, "descricao")).trim();
    const unit = textoCelula(getValue(row, "unidade")).trim() || null;
    const quantityRaw = getValue(row, "quantidade");
    const costRaw = getValue(row, "custo unitario");
    const centerCode = textoCelula(getValue(row, "centro de custo")).trim();
    const quantityProvided = !celulaVazia(quantityRaw);
    const costProvided = !celulaVazia(costRaw);
    const quantity = quantityProvided ? parseNumeroPtBr(quantityRaw) : 0;
    const cost = costProvided ? parseNumeroPtBr(costRaw) : 0;
    let centerId: string | null = null;

    if (!code) rowErrors.push("Código obrigatório.");
    else if (!/^\d+(?:\.\d+)*$/.test(code)) {
      rowErrors.push("Código inválido. Use números separados por ponto.");
    } else if (codigosNaPlanilha.has(code)) {
      rowErrors.push(`Código duplicado: ${code}.`);
    } else {
      codigosNaPlanilha.add(code);
    }

    if (!description) rowErrors.push("Descrição obrigatória.");
    if (quantityProvided && quantity === undefined) {
      rowErrors.push("Quantidade inválida.");
    } else if (quantity !== undefined && quantity < 0) {
      rowErrors.push("Quantidade não pode ser negativa.");
    }
    if (costProvided && cost === undefined) {
      rowErrors.push("Custo unitário inválido.");
    } else if (cost !== undefined && cost < 0) {
      rowErrors.push("Custo unitário não pode ser negativo.");
    }
    if (centerCode) {
      centerId = centrosPorCodigo.get(normalizarCodigoCentro(centerCode)) ?? null;
      if (!centerId) {
        rowErrors.push(`Centro de custo desconhecido: ${centerCode}.`);
      }
    }

    for (const mensagem of rowErrors) adicionaErro(row.linha, mensagem);
    if (!code || !/^\d+(?:\.\d+)*$/.test(code) || rowErrors.some((message) =>
      message.startsWith("Código duplicado:")
    )) {
      continue;
    }

    candidatos.push({
      linha: row.linha,
      codigo: code,
      parentCodigo: parentCodigo(code),
      descricao: description,
      unidade: unit,
      quantidade: quantity ?? 0,
      custoUnitario: cost ?? 0,
      temQuantidade: quantityProvided,
      temCusto: costProvided,
      centroCustoId: centerId,
      erros: rowErrors,
    });
  }

  const codigosComFilhos = new Set(
    candidatos.flatMap((candidate) =>
      candidate.parentCodigo ? [candidate.parentCodigo] : []
    ),
  );
  if (opcoes.modo === "mesclar") {
    for (const existingCode of codigosExistentes) {
      const parent = parentCodigo(existingCode);
      if (parent) codigosComFilhos.add(parent);
    }
  }

  const itens: ItemPlanilhaEap[] = [];
  for (const candidate of candidatos) {
    if (
      candidate.parentCodigo
      && !codigosNaPlanilha.has(candidate.parentCodigo)
      && !(opcoes.modo === "mesclar" && codigosExistentes.has(candidate.parentCodigo))
    ) {
      const message = `Etapa pai ${candidate.parentCodigo} não encontrada.`;
      candidate.erros.push(message);
      adicionaErro(candidate.linha, message);
    }

    const tipo = codigosComFilhos.has(candidate.codigo)
      || (!candidate.temQuantidade && !candidate.temCusto)
      ? "etapa"
      : "servico";
    if (tipo === "servico") {
      if (!candidate.unidade) {
        const message = "Serviço precisa informar uma unidade.";
        candidate.erros.push(message);
        adicionaErro(candidate.linha, message);
      }
      if (candidate.quantidade <= 0) {
        const message = "Serviço precisa ter quantidade maior que zero.";
        candidate.erros.push(message);
        adicionaErro(candidate.linha, message);
      }
    }

    if (candidate.erros.length) continue;
    itens.push({
      codigo: candidate.codigo,
      parent_codigo: candidate.parentCodigo,
      descricao: candidate.descricao,
      tipo,
      unidade: candidate.unidade,
      quantidade: candidate.quantidade,
      custo_unitario: candidate.custoUnitario,
      centro_custo_id: candidate.centroCustoId,
    });
  }

  itens.sort((a, b) => compareCodigoNatural(a.codigo, b.codigo));
  erros.sort((a, b) => a.linha - b.linha || a.mensagem.localeCompare(b.mensagem));
  return { itens, erros };
}

function parentCodigo(code: string) {
  const lastSeparator = code.lastIndexOf(".");
  return lastSeparator === -1 ? null : code.slice(0, lastSeparator);
}

function normalizarCodigoCentro(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

function celulaVazia(value: unknown) {
  const cell = valorPrimitivo(value);
  return cell === null
    || cell === undefined
    || (typeof cell === "string" && !cell.trim());
}

function textoCelula(value: unknown): string {
  const cell = valorPrimitivo(value);
  return typeof cell === "string" || typeof cell === "number"
    ? String(cell)
    : "";
}

function valorPrimitivo(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if ("result" in value) return (value as { result?: unknown }).result;
  if ("text" in value && typeof (value as { text?: unknown }).text === "string") {
    return (value as { text: string }).text;
  }
  if ("richText" in value && Array.isArray((value as { richText: unknown[] }).richText)) {
    return (value as { richText: { text?: string }[] }).richText
      .map((part) => part.text ?? "")
      .join("");
  }
  return value;
}
