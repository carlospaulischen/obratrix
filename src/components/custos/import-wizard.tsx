"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/format";
import messages from "../../../messages/pt-BR.json";

type Preview = {
  lancamentos: number;
  total: number;
  erros: { linha: number; mensagem: string }[];
};

export function CostImportWizard({
  workId,
  locale,
  currency,
}: {
  workId: string;
  locale: string;
  currency: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(intent: "preview" | "confirm") {
    if (!file) {
      setError("Selecione um arquivo .xlsx.");
      return;
    }
    setPending(true);
    setNotice("");
    setError("");
    const body = new FormData();
    body.set("arquivo", file);
    body.set("intent", intent);
    try {
      const response = await fetch(`/api/obras/${workId}/custos/importar`, { method: "POST", body });
      const result = await response.json() as Preview & { error?: string; counts?: { inseridos: number } };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível processar a planilha.");
      } else if (intent === "preview") {
        setPreview(result);
      } else {
        setPreview(null);
        setNotice(`${result.counts?.inseridos ?? 0} lançamento(s) importado(s).`);
        router.refresh();
      }
    } catch {
      setError("Não foi possível comunicar com o servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <FileSpreadsheet size={18} className="text-emerald-700" /> Importar planilha
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Arquivo .xlsx de até 5 MB e 5.000 lançamentos.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/app/obras/${workId}/custos/modelo`}><Download size={15} /> Baixar modelo</a>
        </Button>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 rounded-xl focus-within:ring-2 focus-within:ring-emerald-700 focus-within:ring-offset-2">
          <input
            id={inputId}
            type="file"
            accept=".xlsx"
            aria-label={messages.import.fileInputLabel}
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setError("");
              setNotice("");
            }}
          />
          <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">{messages.import.selectFile}</span>
            <span className="min-w-0 truncate">{file?.name ?? messages.import.noFileSelected}</span>
          </label>
        </div>
        <Button type="button" disabled={!file || pending} onClick={() => void submit("preview")}>
          <Upload size={15} /> {pending ? "Validando..." : "Validar planilha"}
        </Button>
      </div>
      {preview && (
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prévia da importação</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PreviewMetric label="Lançamentos" value={formatNumber(preview.lancamentos, locale)} />
            <PreviewMetric label="Total" value={formatCurrency(preview.total, locale, currency)} />
          </div>
          {preview.erros.length ? (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3">
              <p className="flex items-center gap-2 text-xs font-bold text-rose-800">
                <AlertCircle size={15} /> {preview.erros.length} erro(s) impedem a confirmação
              </p>
              <ul className="mt-2 space-y-1 text-xs text-rose-700">
                {preview.erros.map((item, index) => <li key={`${item.linha}-${index}`}>Linha {item.linha}: {item.mensagem}</li>)}
              </ul>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 size={15} /> Planilha válida e pronta para confirmação.
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button type="button" disabled={pending || preview.erros.length > 0 || preview.lancamentos === 0} onClick={() => void submit("confirm")}>
              {pending ? "Importando..." : "Confirmar importação"}
            </Button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value}</p></div>;
}
