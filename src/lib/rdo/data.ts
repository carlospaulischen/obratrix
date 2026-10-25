export function dataHoje(fusoHorario = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: fusoHorario,
  }).format(new Date());
}

export function dataIsoValida(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function inicioDaSemana(data: string) {
  const date = new Date(`${data}T12:00:00Z`);
  const diasDesdeSegunda = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diasDesdeSegunda);
  return date.toISOString().slice(0, 10);
}
