import Link from "next/link";
import { Brand } from "@/components/brand";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen px-6 py-7 sm:px-12 lg:px-16 lg:py-10">
      <Brand />
      <section className="mx-auto mt-14 max-w-md">
        <Link href="/login" className="text-sm font-medium text-emerald-800 hover:underline">← Voltar para entrar</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Comece pela sua equipe.</h1>
        <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">Crie sua conta para organizar a primeira empresa na Obratrix.</p>
        <SignupForm />
      </section>
    </main>
  );
}
