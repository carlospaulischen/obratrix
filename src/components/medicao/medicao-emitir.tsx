"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { emitirMedicaoAction } from "@/app/actions";

export function MedicaoEmitir({ workId }: { workId: string }) {
  const router = useRouter();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();
  const inputClass =
    "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none";

  const emitir = () => {
    if (!inicio || !fim) {
      setErro("Informe início e fim do período.");
      return;
    }
    setErro("");
    startTransition(async () => {
      const result = await emitirMedicaoAction({
        obraId: workId,
        periodoInicio: inicio,
        periodoFim: fim,
      });
      if (result.error) {
        setErro(result.error);
        return;
      }
      router.push(`/app/obras/${workId}/medicao/${result.medicaoId}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1 text-xs font-semibold text-slate-500">
        Início
        <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${inputClass} block`} />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-500">
        Fim
        <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={`${inputClass} block`} />
      </label>
      <button
        type="button"
        onClick={emitir}
        disabled={pending}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        {pending ? "Emitindo…" : "Emitir medição"}
      </button>
      {erro && <p role="alert" className="w-full text-sm font-medium text-rose-700">{erro}</p>}
    </div>
  );
}
