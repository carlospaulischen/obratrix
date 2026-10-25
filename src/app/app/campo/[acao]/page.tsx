import Link from "next/link";
import { ArrowLeft, Camera, CircleAlert, ClipboardList } from "lucide-react";

const placeholders: Record<string, { title: string; description: string; icon: typeof ClipboardList }> = {
  registrar: { title: "Registro de campo", description: "O registro diário de obra estará disponível em breve.", icon: ClipboardList },
  foto: { title: "Fotos da obra", description: "O envio e a organização de fotos estarão disponíveis em breve.", icon: Camera },
  problema: { title: "Ocorrências", description: "O registro de problemas e ocorrências estará disponível em breve.", icon: CircleAlert },
};

export default async function FieldPlaceholderPage({ params }: { params: Promise<{ acao: string }> }) {
  const { acao } = await params;
  const entry = placeholders[acao];
  if (!entry) return <p className="text-sm text-slate-500">Página não encontrada.</p>;
  const Icon = entry.icon;

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200/70 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon size={24} /></div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{entry.title}</h1>
      <p className="mt-2 text-sm text-slate-500">{entry.description}</p>
      <Link href="/app" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline"><ArrowLeft size={15} /> Voltar para Hoje</Link>
    </section>
  );
}
