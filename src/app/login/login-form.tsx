"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath ?? ""} />
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-700">E-mail</span>
        <span className="relative block">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="voce@construtora.com.br"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          />
        </span>
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-700">Senha</span>
        <span className="relative block">
          <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            placeholder="Sua senha"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          />
        </span>
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Entrando..." : "Entrar na plataforma"}
        <ArrowRight size={17} />
      </Button>
      <p className="text-center text-sm text-slate-500">
        Ainda não tem uma conta?{" "}
        <Link className="font-semibold text-emerald-800 hover:underline" href="/cadastro">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
