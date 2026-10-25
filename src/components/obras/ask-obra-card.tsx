"use client";

import { useId, useState, useTransition } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { askObraAction } from "@/app/actions";

export function AskObraCard({ workId }: { workId: string }) {
  const formId = useId();
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const perguntar = () => {
    const texto = pergunta.trim();
    if (texto.length < 3) {
      setErro("Faça uma pergunta sobre a obra.");
      return;
    }
    startTransition(async () => {
      const result = await askObraAction({ obraId: workId, pergunta: texto });
      setErro(result.error ?? null);
      if (result.resposta) {
        setResposta(result.resposta);
        setPergunta("");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <Sparkles size={17} className="text-emerald-700" /> Pergunte sobre a obra
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Respostas com base nos dados registrados: avanço, serviços, produção da semana, RDOs e alertas.
        </p>
      </div>
      <div className="space-y-4 px-5 py-4">
        {resposta && (
          <div className="rounded-xl bg-emerald-50/60 px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-slate-800">
            {resposta}
          </div>
        )}
        {erro && <p className="text-sm text-rose-600">{erro}</p>}
        <form
          id={formId}
          className="flex items-center gap-2"
          onSubmit={(event) => { event.preventDefault(); perguntar(); }}
        >
          <input
            type="text"
            value={pergunta}
            onChange={(event) => setPergunta(event.target.value)}
            placeholder="Ex.: quanto executamos de alvenaria esta semana?"
            maxLength={500}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            aria-label="Perguntar"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </form>
      </div>
    </section>
  );
}
