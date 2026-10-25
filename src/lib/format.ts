export function formatCurrency(
  value: number | string | null | undefined,
  locale = "pt-BR",
  currency = "BRL",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function formatNumber(
  value: number | string | null | undefined,
  locale = "pt-BR",
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(locale, options).format(Number(value ?? 0));
}

export function formatDate(
  value: string | Date | null | undefined,
  locale = "pt-BR",
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}
