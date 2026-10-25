"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Mic, MicOff, Sparkles } from "lucide-react";
import { parseRdoVozAction, type RdoVozDados } from "@/app/actions";

type ResultadoReconhecimento = { transcript: string; isFinal: boolean };
type EventoReconhecimento = {
  results: ArrayLike<{ 0: ResultadoReconhecimento; isFinal: boolean } & ArrayLike<ResultadoReconhecimento>>;
  resultIndex: number;
};
type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (evento: EventoReconhecimento) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};
type ReconhecimentoCtor = new () => Reconhecimento;

function reconhecimentoDisponivel(): ReconhecimentoCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as { SpeechRecognition?: ReconhecimentoCtor; webkitSpeechRecognition?: ReconhecimentoCtor })
    .SpeechRecognition ?? (window as { webkitSpeechRecognition?: ReconhecimentoCtor }).webkitSpeechRecognition;
  return ctor ?? null;
}

export function RdoVozPanel({ workId, onAplicar }: { workId: string; onAplicar: (dados: RdoVozDados) => void }) {
  const [texto, setTexto] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [pending, startTransition] = useTransition();
  const reconhecimentoRef = useRef<Reconhecimento | null>(null);
  const suportaVoz = typeof window !== "undefined" && reconhecimentoDisponivel() !== null;

  const alternarEscuta = () => {
    const Ctor = reconhecimentoDisponivel();
    if (!Ctor) return;
    if (ouvindo) {
      reconhecimentoRef.current?.stop();
      setOuvindo(false);
      return;
    }
    const reconhecimento = new Ctor();
    reconhecimento.lang = "pt-BR";
    reconhecimento.continuous = true;
    reconhecimento.interimResults = true;
    reconhecimento.onresult = (evento) => {
      let finals = "";
      for (let i = 0; i < evento.results.length; i += 1) {
        const result = evento.results[i] as { 0: { transcript: string }; isFinal: boolean };
        if (result.isFinal) finals += result[0].transcript + " ";
      }
      if (finals) setTexto((prev) => (prev ? `${prev.trimEnd()} ` : "") + finals.trim());
    };
    reconhecimento.onend = () => setOuvindo(false);
    reconhecimento.onerror = () => { setOuvindo(false); setErro("Não consegui captar o áudio — digite o relato no campo."); };
    reconhecimentoRef.current = reconhecimento;
    setErro("");
    setAviso("");
    reconhecimento.start();
    setOuvindo(true);
  };

  const estruturar = () => {
    if (texto.trim().length < 5) {
      setErro("Diga ou escreva o relato do dia antes de estruturar.");
      return;
    }
    setErro("");
    setAviso("");
    startTransition(async () => {
      const result = await parseRdoVozAction({ obraId: workId, texto });
      if (result.error || !result.dados) {
        setErro(result.error ?? "A IA não estruturou o relato.");
        return;
      }
      onAplicar(result.dados);
      if (result.dados.producao_sem_match.length) {
        setAviso(`Não encontrei na EAP: ${result.dados.producao_sem_match.join(", ")} — ajuste o serviço manualmente.`);
      } else {
        setAviso("Campos preenchidos. Revise antes de salvar.");
      }
    });
  };

  return (
    <details className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 sm:p-6" open>
      <summary className="cursor-pointer text-base font-bold text-slate-900">
        <Sparkles size={15} className="mr-1 inline text-emerald-700" /> Ditar o RDO por voz
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-slate-500">
          Fale o que aconteceu no dia — clima, equipe, produção, materiais e ocorrências — e a IA preenche os campos para você revisar.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {suportaVoz && (
            <button
              type="button"
              onClick={alternarEscuta}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white ${
                ouvindo ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-700 hover:bg-emerald-800"
              }`}
            >
              {ouvindo ? <MicOff size={16} /> : <Mic size={16} />}
              {ouvindo ? "Parar de ouvir" : "Falar"}
            </button>
          )}
          <textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={suportaVoz
              ? "Toque em Falar e conte o dia — ou digite aqui. Ex.: manhã ensolarada, 8 pedreiros por 8 horas, executamos 12 m³ de concreto…"
              : "Digite o relato do dia. Ex.: manhã ensolarada, 8 pedreiros por 8 horas, executamos 12 m³ de concreto…"}
            className="min-h-20 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
          />
        </div>
        {erro && <p role="alert" className="text-sm font-medium text-rose-700">{erro}</p>}
        {aviso && <p role="status" className="text-sm font-medium text-amber-800">{aviso}</p>}
        <button
          type="button"
          onClick={estruturar}
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {pending ? "Estruturando…" : "Estruturar com IA"}
        </button>
      </div>
    </details>
  );
}
