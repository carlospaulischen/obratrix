"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { addWorkMemberAction, updateMemberProfileAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

const profileLabels = {
  diretor: "Diretor",
  engenheiro: "Engenheiro",
  encarregado: "Encarregado",
  financeiro: "Financeiro",
};

export function MemberProfileForm({
  userId,
  currentUserId,
  profile,
  name,
}: {
  userId: string;
  currentUserId: string;
  profile: keyof typeof profileLabels;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(updateMemberProfileAction, {});
  const canChange = userId !== currentUserId;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="usuario_id" value={userId} />
      <label className="sr-only" htmlFor={`perfil-${userId}`}>Perfil de {name}</label>
      <select
        id={`perfil-${userId}`}
        name="perfil"
        defaultValue={profile}
        disabled={!canChange || pending}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {Object.entries(profileLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {canChange && <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>}
      {state.error && <span role="alert" className="w-full text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}

export function WorkMemberForm({
  workId,
  members,
}: {
  workId: string;
  members: { userId: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(addWorkMemberAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
      <input type="hidden" name="obra_id" value={workId} />
      <label className="flex flex-1 items-center gap-2 text-xs font-semibold text-slate-600">
        <UserPlus size={15} className="text-slate-400" />
        <span className="sr-only">Adicionar membro da empresa</span>
        <select
          name="usuario_id"
          required
          disabled={pending}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-600"
        >
          <option value="">Adicionar membro da empresa…</option>
          {members.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}
        </select>
      </label>
      <Button type="submit" size="sm" disabled={pending}><UserPlus size={14} />{pending ? "Adicionando..." : "Adicionar"}</Button>
      {state.error && <p role="alert" className="text-xs text-rose-600 sm:w-full">{state.error}</p>}
    </form>
  );
}
