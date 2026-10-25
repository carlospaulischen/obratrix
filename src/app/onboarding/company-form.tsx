"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { createCompanyAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function CompanyForm() {
  const [state, formAction, pending] = useActionState(createCompanyAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <label className="block space-y-2 text-sm font-semibold text-slate-700">
        Nome da empresa
        <input name="nome" autoComplete="organization" required className="form-input" placeholder="Ex.: Construtora Horizonte" />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-slate-700">
        CNPJ <span className="font-normal text-slate-400">· opcional</span>
        <input name="cnpj" inputMode="numeric" className="form-input" placeholder="00.000.000/0000-00" />
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando empresa..." : "Criar empresa"}
        <ArrowRight size={17} />
      </Button>
    </form>
  );
}
