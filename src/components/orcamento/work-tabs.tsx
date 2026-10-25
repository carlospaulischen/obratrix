import Link from "next/link";

export function WorkTabs({
  workId,
  active,
  showCosts = false,
}: {
  workId: string;
  active: "resumo" | "orcamento" | "cronograma" | "semanal" | "rdo" | "custos";
  showCosts?: boolean;
}) {
  const tabs = [
    { href: `/app/obras/${workId}`, label: "Resumo", id: "resumo" },
    { href: `/app/obras/${workId}/orcamento`, label: "Orçamento/EAP", id: "orcamento" },
    { href: `/app/obras/${workId}/cronograma`, label: "Cronograma", id: "cronograma" },
    { href: `/app/obras/${workId}/semanal`, label: "Semanal", id: "semanal" },
    { href: `/app/obras/${workId}/rdo`, label: "RDO", id: "rdo" },
    ...(showCosts ? [{ href: `/app/obras/${workId}/custos`, label: "Custos", id: "custos" as const }] : []),
  ];

  return (
    <nav aria-label="Seções da obra" className="flex gap-6 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={active === tab.id ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold ${
            active === tab.id
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
