import { compareCodigoNatural } from "./parse-planilha";

export type ItemArvoreEap = {
  id: string;
  codigo: string;
  parent_id: string | null;
  tipo: "etapa" | "servico";
  quantidade: number;
  custo_unitario: number;
  custo_total?: number | null;
  executado?: number;
};

export type NoArvoreEap<T extends ItemArvoreEap> = T & {
  filhos: NoArvoreEap<T>[];
  totalOrcado: number;
  valorExecutado: number;
};

type NoMutavel<T extends ItemArvoreEap> = {
  item: T;
  filhos: NoMutavel<T>[];
};

export function construirArvoreEap<T extends ItemArvoreEap>(
  itens: readonly T[],
): NoArvoreEap<T>[] {
  const nos = new Map<string, NoMutavel<T>>(
    itens.map((item): [string, NoMutavel<T>] => [item.id, { item, filhos: [] }]),
  );
  const raizes: NoMutavel<T>[] = [];

  for (const no of nos.values()) {
    const parent = no.item.parent_id ? nos.get(no.item.parent_id) : undefined;
    if (parent) parent.filhos.push(no);
    else raizes.push(no);
  }

  const calcula = (no: NoMutavel<T>): NoArvoreEap<T> => {
    const filhos = no.filhos
      .sort((a, b) => compareCodigoNatural(a.item.codigo, b.item.codigo))
      .map(calcula);
    const totalOrcado = no.item.tipo === "etapa"
      ? filhos.reduce((total, child) => total + child.totalOrcado, 0)
      : Number(no.item.custo_total ?? no.item.quantidade * no.item.custo_unitario);
    const valorExecutado = no.item.tipo === "etapa"
      ? filhos.reduce((total, child) => total + child.valorExecutado, 0)
      : Math.min(
        Math.max(Number(no.item.executado ?? 0), 0),
        Math.max(Number(no.item.quantidade), 0),
      ) * Number(no.item.custo_unitario);

    return { ...no.item, filhos, totalOrcado, valorExecutado };
  };

  return raizes
    .sort((a, b) => compareCodigoNatural(a.item.codigo, b.item.codigo))
    .map(calcula);
}

export function percentualExecutadoEap(node: { totalOrcado: number; valorExecutado: number }) {
  if (node.totalOrcado <= 0) return 0;
  return Math.min(100, Math.max(0, (node.valorExecutado / node.totalOrcado) * 100));
}
