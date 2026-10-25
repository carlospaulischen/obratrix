import { ClipboardCheck, HardHat, TrendingUp } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
      <section className="flex flex-col justify-between px-6 py-7 sm:px-12 lg:px-16 lg:py-10">
        <Brand />
        <div className="mx-auto w-full max-w-md py-12">
          <div className="mb-8">
            <div className="mb-3 text-sm font-semibold text-emerald-700">BEM-VINDO DE VOLTA</div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">A obra segue. Você no controle.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Entre na sua conta para acompanhar equipe, planejamento e custos das suas obras.
            </p>
          </div>
          <LoginForm nextPath={next} />
          <p className="mt-8 text-center text-xs text-slate-400">
            Ao continuar, você concorda com os termos de uso da Obratrix.
          </p>
        </div>
        <p className="text-xs text-slate-400">© 2025 Obratrix · Gestão simples, obra eficiente.</p>
      </section>

      <aside className="relative hidden overflow-hidden bg-[#0c3429] px-14 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-36 -top-40 size-[520px] rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-24 size-[390px] rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-20 size-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-emerald-100">
            <span className="size-2 rounded-full bg-emerald-300" />
            Cada detalhe conta
          </div>
          <h2 className="mt-8 text-5xl font-semibold leading-[1.12] tracking-tight">
            Da fundação à entrega, <span className="text-emerald-300">tudo conectado.</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-emerald-50/70">
            Um lugar para acompanhar o que acontece no campo e tomar decisões com segurança.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { icon: HardHat, label: "Campo conectado" },
            { icon: ClipboardCheck, label: "Rotina organizada" },
            { icon: TrendingUp, label: "Obra sob controle" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Icon className="mb-7 text-emerald-300" size={20} />
              <p className="text-sm font-medium text-white/90">{label}</p>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
