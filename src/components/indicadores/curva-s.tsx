"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";

type Point = { semana: string; valorPlanejado: number; valorAgregado: number; custoReal: number };

export function CurvaS({
  points,
  locale,
  currency,
}: {
  points: Point[];
  locale: string;
  currency: string;
}) {
  const money = (value: number) => formatCurrency(value, locale, currency);
  const compactMoney = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: 12 }}>
          <CartesianGrid stroke="#e9efeb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="semana" tickFormatter={(date) => formatDate(date, locale, { day: "2-digit", month: "2-digit" })} tick={{ fill: "#64748b", fontSize: 10 }} minTickGap={24} />
          <YAxis width={100} tickFormatter={(value: number) => compactMoney.format(value)} tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip
            labelFormatter={(date) => `Semana de ${formatDate(String(date), locale)}`}
            formatter={(value) => [money(Number(value)), ""]}
            contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="valorPlanejado" name="Planejado (PV)" stroke="#64748b" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="valorAgregado" name="Valor agregado (EV)" stroke="#047857" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="custoReal" name="Custo real (AC)" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
