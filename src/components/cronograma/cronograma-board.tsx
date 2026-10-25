"use client";

import { useMemo, useState, useTransition } from "react";
import { saveCronogramaAction } from "@/app/actions";

type CronogramaItem = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: "etapa" | "servico";
  unidade: string | null;
  quantidade: number;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  executado: number;
};

function pct(inicio: number, fim: number, value: string) {
  const point = new Date(`${value}T00:00:00.000Z`).getTime();
  return Math.min(100, Math.max(0, ((point - inicio) / (fim - inicio)) * 100));
}

function formatDateBr(value: string | null, locale: string) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CronogramaBoard({
  workId,
  items,
  obraInicio,
  obraFim,
  hoje,
  canEdit,
  locale,
}: {
  workId: string;
  items: CronogramaItem[];
  obraInicio: string | null;
  obraFim: string | null;
  hoje: string;
  canEdit: boolean;
  locale: string;
}) {
  const [draft, setDraft] = useState<Record<string, { inicio: string; fim: string }>>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const range = useMemo(() => {
    const starts = [obraInicio, ...items.map((item) => draft[item.id]?.inicio ?? item.inicioPrevisto)].filter(Boolean) as string[];
    const ends = [obraFim, ...items.map((item) => draft[item.id]?.fim ?? item.fimPrevisto)].filter(Boolean) as string[];
    if (!starts.length || !ends.length) return null;
    const inicio = new Date(`${starts.sort()[0]}T00:00:00.000Z`).getTime();
    let fim = new Date(`${ends.sort().at(-1)}T00:00:00.000Z`).getTime();
    if (fim <= inicio) fim = inicio + 1;
    return { inicio, fim };
  }, [items, obraInicio, obraFim, draft]);

  const setItemDate = (id: string, campo: "inicio" | "fim", valor: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const current = draft[id] ?? { inicio: item.inicioPrevisto ?? "", fim: item.fimPrevisto ?? "" };
    setDraft((prev) => ({ ...prev, [id]: { ...current, [campo]: valor } }));
  };

  const dirty = Object.keys(draft).length > 0;

  const save = () => {
    startTransition(async () => {
      const payload = Object.entries(draft).map(([id, datas]) => ({
        id,
        inicioPrevisto: datas.inicio || null,
        fimPrevisto: datas.fim || null,
      }));
      const result = await saveCronogramaAction({ obraId: workId, itens: payload });
      setMessage(result);
      if (!result.error) setDraft({});
    });
  };

  const hojePct = range ? pct(range.inicio, range.fim, hoje) : null;

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Janela prevista por serviço</h2>
          <p className="mt-1 text-xs text-slate-500">
            Período da obra: {formatDateBr(obraInicio, locale)} — {formatDateBr(obraFim, locale)} · hoje {formatDateBr(hoje, locale)}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            {message.error && <p role="alert" className="text-xs font-semibold text-rose-700">{message.error}</p>}
            {message.success && <p className="text-xs font-semibold text-emerald-700">{message.success}</p>}
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={save}
              className="min-h-10 rounded-lg bg-emerald-800 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar cronograma"}
            </button>
          </div>
        )}
      </div>

      {!range ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Defina as datas de início e fim da obra para visualizar o cronograma.
        </p>
      ) : (
        <div className="relative space-y-1.5">
          {hojePct !== null && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-dashed border-rose-500"
              style={{ left: `calc(55% + 45% * ${hojePct / 100})` }}
            />
          )}
          {items.map((item) => {
            if (item.tipo === "etapa") {
              const depth = item.codigo.split(".").length - 1;
              return (
                <div key={item.id} className="pt-3 first:pt-0">
                  <p className={`text-xs font-bold uppercase tracking-wide text-slate-700 ${depth > 0 ? "pl-3" : ""}`}>
                    {item.codigo} · {item.descricao}
                  </p>
                </div>
              );
            }
            const inicio = draft[item.id]?.inicio ?? item.inicioPrevisto ?? "";
            const fim = draft[item.id]?.fim ?? item.fimPrevisto ?? "";
            const executadoPct = item.quantidade > 0 ? Math.min(1, item.executado / item.quantidade) : 0;
            const temJanela = Boolean(inicio && fim);
            const atrasado = temJanela && fim < hoje && executadoPct < 1;
            const barLeft = temJanela ? pct(range.inicio, range.fim, inicio) : 0;
            const barRight = temJanela ? pct(range.inicio, range.fim, fim) : 0;
            const barWidth = Math.max(0.8, barRight - barLeft);
            return (
              <div key={item.id} className="grid grid-cols-[55%_45%] items-center gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.codigo} · {item.descricao}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    {canEdit ? (
                      <>
                        <input
                          aria-label={`Início previsto de ${item.codigo}`}
                          type="date"
                          value={inicio}
                          onChange={(event) => setItemDate(item.id, "inicio", event.target.value)}
                          className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                        />
                        <span>→</span>
                        <input
                          aria-label={`Fim previsto de ${item.codigo}`}
                          type="date"
                          value={fim}
                          onChange={(event) => setItemDate(item.id, "fim", event.target.value)}
                          className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                        />
                      </>
                    ) : (
                      <span>
                        {formatDateBr(inicio || null, locale)} → {formatDateBr(fim || null, locale)}
                      </span>
                    )}
                    <span>
                      {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(executadoPct * 100)}% executado
                      {item.unidade ? ` · ${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(item.executado)}/${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(item.quantidade)} ${item.unidade}` : ""}
                    </span>
                  </div>
                </div>
                <div className="relative h-6 rounded-md bg-slate-100">
                  {temJanela ? (
                    <div
                      className={`absolute inset-y-0.5 rounded-md ${atrasado ? "bg-rose-200" : "bg-emerald-100"}`}
                      style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                    >
                      <div
                        className={`h-full rounded-md ${atrasado ? "bg-rose-500" : "bg-emerald-600"}`}
                        style={{ width: `${executadoPct * 100}%` }}
                      />
                    </div>
                  ) : (
                    <p className="px-2 text-[10px] leading-6 text-slate-400">sem janela</p>
                  )}
                </div>
              </div>
            );
          })}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-emerald-600" /> executado</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-emerald-100" /> janela prevista</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-rose-500" /> atrasado</span>
            <span className="flex items-center gap-1.5"><span className="h-4 border-l-2 border-dashed border-rose-500" /> hoje</span>
          </div>
        </div>
      )}
    </section>
  );
}
