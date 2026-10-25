import { Building2 } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
        <Building2 size={21} strokeWidth={2.3} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight text-slate-900">Obratrix</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Gestão de obras
          </div>
        </div>
      )}
    </div>
  );
}
