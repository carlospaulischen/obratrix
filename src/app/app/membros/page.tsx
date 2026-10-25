import Link from "next/link";
import { ArrowLeft, UsersRound } from "lucide-react";
import { getCompanyContext } from "@/lib/company";
import { MemberProfileForm } from "@/components/membership-forms";

const profileLabels: Record<string, string> = {
  diretor: "Diretor",
  engenheiro: "Engenheiro",
  encarregado: "Encarregado",
  financeiro: "Financeiro",
};

export default async function MembersPage() {
  const { supabase, company, perfil, user } = await getCompanyContext();
  if (perfil !== "diretor") {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Somente o diretor pode gerenciar os membros da empresa.</div>;
  }

  const { data: memberships, error } = await supabase
    .from("obx_empresa_membros")
    .select("usuario_id,perfil,created_at")
    .eq("empresa_id", company.id)
    .order("created_at");
  const { data: profiles } = memberships?.length
    ? await supabase.from("obx_usuarios").select("id,nome,email").in("id", memberships.map((entry) => entry.usuario_id))
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div>
        <Link href="/app" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800"><ArrowLeft size={15} /> Voltar ao painel</Link>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Equipe da empresa</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Membros</h1>
            <p className="mt-2 text-sm text-slate-500">Gerencie perfis e permissões de acesso à {company.nome}.</p>
          </div>
          <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:flex"><UsersRound size={15} /> {memberships?.length ?? 0} pessoas</span>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Não foi possível carregar os membros.</p>}
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
        <div className="hidden grid-cols-[1fr_190px_130px] border-b border-slate-100 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
          <span>Pessoa</span><span>Perfil</span><span>Acesso</span>
        </div>
        <div className="divide-y divide-slate-100">
          {(memberships ?? []).map((membership) => {
            const profile = profileById.get(membership.usuario_id);
            return (
              <div key={membership.usuario_id} className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_190px_130px] sm:items-center sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-800">
                    {(profile?.nome ?? profile?.email ?? "?").slice(0, 1).toLocaleUpperCase("pt-BR")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{profile?.nome ?? "Membro"}</p>
                    <p className="truncate text-xs text-slate-400">{profile?.email ?? ""}</p>
                  </div>
                </div>
                <MemberProfileForm
                  userId={membership.usuario_id}
                  currentUserId={user.id}
                  profile={membership.perfil}
                  name={profile?.nome ?? profile?.email ?? "membro"}
                />
                <div className="text-xs text-slate-500 sm:text-right">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-600">{profileLabels[membership.perfil] ?? membership.perfil}</span>
                </div>
              </div>
            );
          })}
          {!memberships?.length && <p className="px-6 py-10 text-center text-sm text-slate-500">Ainda não há membros nesta empresa.</p>}
        </div>
      </section>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
        <p className="text-sm font-semibold text-blue-950">Convide sua equipe</p>
        <p className="mt-1 text-xs leading-5 text-blue-900/70">TODO: convites por e-mail serão habilitados em uma próxima etapa. Por enquanto, cada pessoa deve criar a própria conta e o diretor pode ajustar o perfil após o cadastro.</p>
      </div>
    </div>
  );
}
