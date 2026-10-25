import { Building2, Check } from "lucide-react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CompanyForm } from "./company-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await supabase
    .from("obx_empresa_membros")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .limit(1);
  if (memberships?.length) redirect("/app");

  return (
    <main className="min-h-screen bg-white px-6 py-7 sm:px-12 lg:px-16 lg:py-10">
      <Brand />
      <section className="mx-auto mt-16 grid max-w-5xl items-center gap-12 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
            <Building2 size={26} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Primeiro passo</p>
          <h1 className="mt-3 max-w-lg text-4xl font-bold tracking-tight text-slate-900">Vamos preparar seu espaço de trabalho.</h1>
          <p className="mt-4 max-w-lg leading-7 text-slate-500">
            Sua empresa será criada com você como diretor. Depois, você poderá organizar obras e adicionar as pessoas da equipe.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-600">
            {["Dados da empresa", "Obras e planejamento", "Equipe e permissões"].map((step) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Check size={14} /></span>
                {step}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 sm:p-8">
          <h2 className="mb-6 text-xl font-bold text-slate-900">Criar empresa</h2>
          <CompanyForm />
        </div>
      </section>
    </main>
  );
}
