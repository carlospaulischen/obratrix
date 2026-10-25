"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { ModoImportacaoEap } from "@/lib/orcamento/parse-planilha";
import messages from "../../../messages/pt-BR.json";

type Preview = {
  etapas: number;
  servicos: number;
  total: number;
  erros: { linha: number; mensagem: string }[];
};

export function EapImportWizard({
  workId,
  locale,
  currency,
}: {
  workId: string;
  locale: string;
  currency: string;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ModoImportacaoEap>("mesclar");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(intent: "preview" | "confirm", selectedMode = mode) {
    if (!file) {
      setError("Selecione um arquivo .xlsx.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    const body = new FormData();
    body.set("arquivo", file);
    body.set("modo", selectedMode);
    body.set("intent", intent);
    try {
      const response = await fetch(`/api/obras/${workId}/orcamento/importar`, {
        method: "POST",
        body,
      });
      const result = await response.json() as Preview & {
        error?: string;
        counts?: { inseridos: number; atualizados: number; excluidos: number };
      };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível processar a planilha.");
      } else if (intent === "preview") {
        setPreview(result);
      } else {
        const counts = result.counts;
        setMessage(
          `Importação concluída: ${counts?.inseridos ?? 0} inseridos, `
          + `${counts?.atualizados ?? 0} atualizados e ${counts?.excluidos ?? 0} removidos.`,
        );
        setPreview(null);
        router.refresh();
      }
    } catch {
      setError("Não foi possível comunicar com o servidor.");
    } finally {
      setPending(false);
    }
  }

  function changeMode(nextMode: ModoImportacaoEap) {
    setMode(nextMode);
    if (preview && file) void submit("preview", nextMode);
  }

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <FileSpreadsheet size={18} className="text-emerald-700" /> Importar planilha
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Arquivo .xlsx de até 5 MB e 5.000 linhas.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/app/obras/${workId}/orcamento/modelo`}>
            <Download size={15} /> Baixar modelo
          </a>
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 rounded-xl focus-within:ring-2 focus-within:ring-emerald-700 focus-within:ring-offset-2">
          <input
            id={fileInputId}
            type="file"
            accept=".xlsx"
            aria-label={messages.import.fileInputLabel}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setMessage("");
              setError("");
            }}
            className="sr-only"
          />
          <label htmlFor={fileInputId} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
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
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PreviewMetric label="Etapas" value={formatNumber(preview.etapas, locale)} />
            <PreviewMetric label="Serviços" value={formatNumber(preview.servicos, locale)} />
            <PreviewMetric
              label="Total orçado"
              value={formatCurrency(preview.total, locale, currency)}
            />
          </div>
          <fieldset className="mt-5">
            <legend className="text-xs font-semibold text-slate-700">Modo de confirmação</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([
                ["mesclar", "Mesclar por código", "Atualiza os existentes e inclui novos."],
                ["substituir", "Substituir", "Apaga e recria a EAP da obra."],
              ] as const).map(([value, label, description]) => (
                <label key={value} className="flex cursor-pointer gap-2 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="radio"
                    name="modo-importacao"
                    checked={mode === value}
                    onChange={() => changeMode(value)}
                    className="mt-0.5 accent-emerald-700"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-slate-800">{label}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {preview.erros.length > 0 ? (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3">
              <p className="flex items-center gap-2 text-xs font-bold text-rose-800">
                <AlertCircle size={15} /> {preview.erros.length} erro(s) impedem a confirmação
              </p>
              <ul className="mt-2 space-y-1 text-xs text-rose-700">
                {preview.erros.map((item, index) => (
                  <li key={`${item.linha}-${index}`}>Linha {item.linha}: {item.mensagem}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 size={15} /> Planilha válida e pronta para confirmação.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              disabled={pending || preview.erros.length > 0}
              onClick={() => void submit("confirm")}
            >
              {pending ? "Importando..." : "Confirmar importação"}
            </Button>
          </div>
        </div>
      )}
      {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
