"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signupAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-2 text-sm font-semibold text-slate-700">
        Nome completo
        <input name="nome" autoComplete="name" required className="form-input" placeholder="Seu nome" />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-slate-700">
        E-mail
        <input name="email" type="email" autoComplete="email" required className="form-input" placeholder="voce@empresa.com.br" />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-slate-700">
        Senha
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className="form-input" placeholder="Mínimo de 8 caracteres" />
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>}
      {state.success && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.success}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando conta..." : "Criar minha conta"}
        <ArrowRight size={17} />
      </Button>
      <p className="text-center text-sm text-slate-500">
        Já tem conta? <Link href="/login" className="font-semibold text-emerald-800">Entrar</Link>
      </p>
    </form>
  );
}
