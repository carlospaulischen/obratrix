"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { savePlanoSemanalAction } from "@/app/actions";

type Servico = {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  executado: number;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
};

type PlanoItem = { eapItemId: string; quantidadePlanejada: number; executado: number };
type Plano = {
  id: string;
  semanaInicio: string;
  semanaFim: string;
  status: "aberto" | "fechado";
  itens: PlanoItem[];
  ppc: number | null;
};

type Linha = { servico: string; quantidade: string };

const mondayOf = (iso: string) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatBr = (iso: string, locale: string) =>
  new Date(`${iso}T12:00:00.000Z`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });

export function SemanalManager({
  workId,
  services,
  planos,
  canEdit,
  hoje,
  locale,
}: {
  workId: string;
  services: Servico[];
  planos: Plano[];
  canEdit: boolean;
  hoje: string;
  locale: string;
}) {
  const listId = useId();
  const serviceByLabel = useMemo(() => {
    const map = new Map<string, Servico>();
    for (const service of services) map.set(`${service.codigo} · ${service.descricao}`, service);
    return map;
  }, [services]);
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  const [semana, setSemana] = useState(mondayOf(hoje));
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [formAberto, setFormAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);

  const novoPlano = () => {
    setLinhas([{ servico: "", quantidade: "" }]);
    setEditandoId(null);
    setMessage({});
    setFormAberto(true);
  };

  const editarPlano = (plano: Plano) => {
    setSemana(plano.semanaInicio);
    setLinhas(
      plano.itens.map((item) => {
        const service = serviceById.get(item.eapItemId);
        return {
          servico: service ? `${service.codigo} · ${service.descricao}` : item.eapItemId,
          quantidade: String(item.quantidadePlanejada),
        };
      }),
    );
    setEditandoId(plano.id);
    setMessage({});
    setFormAberto(true);
  };

  const puxarDoCronograma = () => {
    const fim = addDays(semana, 6);
    const sugeridos = services
      .filter((service) => {
        if (!service.inicioPrevisto || !service.fimPrevisto) return false;
        const saldo = service.quantidade - service.executado;
        return service.inicioPrevisto <= fim && service.fimPrevisto >= semana && saldo > 0;
      })
      .map((service) => {
        const saldo = service.quantidade - service.executado;
        const inicio = new Date(`${service.inicioPrevisto}T00:00:00.000Z`).getTime();
        const fimServico = new Date(`${service.fimPrevisto}T00:00:00.000Z`).getTime();
        const dias = Math.max(1, Math.round((fimServico - inicio) / 86400000) + 1);
        const ritmo = service.quantidade / dias;
        const qtd = Math.min(saldo, ritmo * 6);
        return { servico: `${service.codigo} · ${service.descricao}`, quantidade: qtd.toFixed(2).replace(/\.?0+$/, "") };
      });
    setLinhas(sugeridos.length ? sugeridos : [{ servico: "", quantidade: "" }]);
    setMessage(sugeridos.length ? {} : { error: "Nenhum serviço com janela prevista nesta semana e saldo aberto." });
  };

  const salvar = () => {
    startTransition(async () => {
      const itens = linhas
        .map((linha) => {
          const service = serviceByLabel.get(linha.servico.trim());
          const quantidade = Number(linha.quantidade.replace(",", "."));
          return service && quantidade > 0
            ? { eapItemId: service.id, quantidadePlanejada: quantidade }
            : null;
        })
        .filter((item): item is { eapItemId: string; quantidadePlanejada: number } => item !== null);
      if (linhas.some((linha) => linha.servico.trim() || linha.quantidade.trim()) && itens.length !== linhas.filter((linha) => linha.servico.trim() || linha.quantidade.trim()).length) {
        setMessage({ error: "Há linhas com serviço ou quantidade inválidos." });
        return;
      }
      const result = await savePlanoSemanalAction({ obraId: workId, semanaInicio: semana, itens });
      setMessage(result);
      if (!result.error) {
        setFormAberto(false);
        setEditandoId(null);
        setLinhas([]);
      }
    });
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">{editandoId ? "Editar plano semanal" : "Novo plano semanal"}</h2>
            {!formAberto && (
              <button type="button" onClick={novoPlano} className="min-h-10 rounded-lg bg-emerald-800 px-4 text-xs font-semibold text-white">
                Planejar semana
              </button>
            )}
          </div>
          {formAberto && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Semana (segunda-feira)
                  <input
                    type="date"
                    value={semana}
                    onChange={(event) => setSemana(event.target.value ? mondayOf(event.target.value) : semana)}
                    className="block min-h-10 rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </label>
                <button type="button" onClick={puxarDoCronograma} className="min-h-10 rounded-lg border border-emerald-200 px-4 text-xs font-semibold text-emerald-800">
                  Puxar do cronograma
                </button>
              </div>
              <datalist id={listId}>
                {services.map((service) => (
                  <option key={service.id} value={`${service.codigo} · ${service.descricao}`}>
                    {service.unidade ?? ""} · saldo {numberFmt.format(service.quantidade - service.executado)}
                  </option>
                ))}
              </datalist>
              <div className="space-y-2">
                {linhas.map((linha, index) => {
                  const service = serviceByLabel.get(linha.servico.trim());
                  return (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <input
                        list={listId}
                        value={linha.servico}
                        onChange={(event) =>
                          setLinhas((prev) => prev.map((entry, i) => (i === index ? { ...entry, servico: event.target.value } : entry)))
                        }
                        placeholder="Serviço (código · descrição)"
                        className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                      <input
                        value={linha.quantidade}
                        onChange={(event) =>
                          setLinhas((prev) => prev.map((entry, i) => (i === index ? { ...entry, quantidade: event.target.value } : entry)))
                        }
                        placeholder={service?.unidade ? `Qtd (${service.unidade})` : "Qtd"}
                        inputMode="decimal"
                        className="min-h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                      <button
                        type="button"
                        aria-label="Remover linha"
                        onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== index))}
                        className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLinhas((prev) => [...prev, { servico: "", quantidade: "" }])}
                  className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600"
                >
                  + Serviço
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={salvar}
                  className="min-h-10 rounded-lg bg-emerald-800 px-4 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Salvando…" : "Salvar plano"}
                </button>
                <button
                  type="button"
                  onClick={() => { setFormAberto(false); setEditandoId(null); setLinhas([]); setMessage({}); }}
                  className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                {message.error && <p role="alert" className="text-xs font-semibold text-rose-700">{message.error}</p>}
                {message.success && <p className="text-xs font-semibold text-emerald-700">{message.success}</p>}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        {planos.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nenhum plano semanal ainda. {canEdit ? "Clique em Planejar semana para começar." : "O engenheiro da obra ainda não criou o plano desta semana."}
          </p>
        )}
        {planos.map((plano) => (
          <article key={plano.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  Semana {formatBr(plano.semanaInicio, locale)} — {formatBr(plano.semanaFim, locale)}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {plano.itens.length} {plano.itens.length === 1 ? "item planejado" : "itens planejados"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    plano.ppc === null
                      ? "bg-slate-100 text-slate-500"
                      : plano.ppc >= 0.8
                        ? "bg-emerald-100 text-emerald-800"
                        : plano.ppc >= 0.5
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                  }`}
                >
                  PPC {plano.ppc === null ? "—" : `${Math.round(plano.ppc * 100)}%`}
                </span>
                {canEdit && (
                  <button type="button" onClick={() => editarPlano(plano)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">
                    Editar
                  </button>
                )}
              </div>
            </div>
            {plano.itens.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="pb-2 pr-4 font-semibold">Serviço</th>
                      <th className="pb-2 pr-4 text-right font-semibold">Planejado</th>
                      <th className="pb-2 pr-4 text-right font-semibold">Executado</th>
                      <th className="pb-2 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plano.itens.map((item) => {
                      const service = serviceById.get(item.eapItemId);
                      const cumprido = item.executado >= item.quantidadePlanejada;
                      return (
                        <tr key={item.eapItemId} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-4 text-slate-800">
                            {service ? `${service.codigo} · ${service.descricao}` : item.eapItemId}
                            {service?.unidade ? <span className="text-slate-400"> ({service.unidade})</span> : null}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{numberFmt.format(item.quantidadePlanejada)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{numberFmt.format(item.executado)}</td>
                          <td className={`py-2 text-right text-xs font-bold ${cumprido ? "text-emerald-700" : "text-rose-700"}`}>
                            {cumprido ? "✓ cumprido" : "pendente"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
