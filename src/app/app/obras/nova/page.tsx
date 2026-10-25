import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WorkForm } from "@/components/work-form";
import { getCompanyContext } from "@/lib/company";

export default async function NewWorkPage() {
  const { perfil } = await getCompanyContext();
  if (perfil !== "diretor") {
    return <p className="rounded-2xl bg-amber-50 p-6 text-sm text-amber-900">Somente o diretor pode cadastrar obras.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/app/obras" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800"><ArrowLeft size={15} /> Voltar para obras</Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Cadastrar obra</h1>
        <p className="mt-2 text-sm text-slate-500">Comece com os dados básicos. Você pode complementar depois.</p>
      </div>
      <WorkForm />
    </div>
  );
}
