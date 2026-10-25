import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkForm } from "@/components/work-form";
import { getCompanyContext } from "@/lib/company";

export default async function EditWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, company, perfil } = await getCompanyContext();
  if (perfil !== "diretor") {
    return <p className="rounded-2xl bg-amber-50 p-6 text-sm text-amber-900">Somente o diretor pode editar obras.</p>;
  }

  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cliente,endereco,cidade,uf,data_inicio,data_fim_prevista,valor_contrato,status")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={`/app/obras/${work.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800"><ArrowLeft size={15} /> Voltar para detalhes</Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Editar obra</h1>
        <p className="mt-2 text-sm text-slate-500">Atualize as informações de {work.nome}.</p>
      </div>
      <WorkForm
        initialValues={{
          ...work,
          cliente: work.cliente ?? "",
          endereco: work.endereco ?? "",
          cidade: work.cidade ?? "",
          uf: work.uf ?? "",
          data_inicio: work.data_inicio ?? "",
          data_fim_prevista: work.data_fim_prevista ?? "",
        }}
        isEditing
      />
    </div>
  );
}
