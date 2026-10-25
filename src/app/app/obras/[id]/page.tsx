import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
  UsersRound,
} from "lucide-react";
import { WorkMemberForm } from "@/components/membership-forms";
import { Button } from "@/components/ui/button";
import { getCompanyContext } from "@/lib/company";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

const statusLabels: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  paralisada: "Paralisada",
  concluida: "Concluída",
};

export default async function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, company, perfil } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,cliente,endereco,cidade,uf,data_inicio,data_fim_prevista,valor_contrato,status")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const [{ data: summary }, { data: workMemberRows }] = await Promise.all([
    supabase.from("obx_vw_obra_resumo").select("orcado_total,custo_realizado,valor_executado,avanco_fisico_pct,avanco_planejado_pct").eq("obra_id", id).maybeSingle(),
    supabase.from("obx_obra_membros").select("usuario_id").eq("obra_id", id),
  ]);
  const memberIds = (workMemberRows ?? []).map((entry) => entry.usuario_id);
  const [{ data: workProfiles }, { data: companyMemberships }] = await Promise.all([
    memberIds.length
      ? supabase.from("obx_usuarios").select("id,nome,email").in("id", memberIds)
      : Promise.resolve({ data: [] }),
    perfil === "diretor"
      ? supabase.from("obx_empresa_membros").select("usuario_id,perfil").eq("empresa_id", company.id)
      : Promise.resolve({ data: [] }),
  ]);
  const { data: companyProfiles } = companyMemberships?.length
    ? await supabase.from("obx_usuarios").select("id,nome,email").in("id", companyMemberships.map((entry) => entry.usuario_id))
    : { data: [] };
  const profileById = new Map((companyProfiles ?? workProfiles ?? []).map((profile) => [profile.id, profile]));
  const workMemberSet = new Set(memberIds);
  const availableMembers = (companyMemberships ?? []).filter((member) => !workMemberSet.has(member.usuario_id));

  const progress = Number(summary?.avanco_fisico_pct ?? 0);
  const contract = Number(work.valor_contrato ?? 0);
  const location = [work.endereco, [work.cidade, work.uf].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");

  return (
    <div className="space-y-7">
      <Link href="/app/obras" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800">
        <ArrowLeft size={15} /> Todas as obras
      </Link>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><span className="text-sm font-bold">OB</span></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{work.codigo} <span className="px-1">·</span> {statusLabels[work.status] ?? work.status}</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{work.nome}</h1>
              <p className="mt-2 text-sm text-slate-500">{work.cliente ?? "Cliente não informado"}</p>
              {location && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><MapPin size={14} />{location}</p>}
            </div>
          </div>
          {perfil === "diretor" && (
            <Button asChild variant="outline" className="shrink-0">
              <Link href={`/app/obras/${work.id}/editar`}><Pencil size={15} /> Editar obra</Link>
            </Button>
          )}
        </div>

        <div className="mt-7 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
          <Metric label="Valor do contrato" value={formatCurrency(contract, company.locale, company.moeda)} note="valor acordado com o cliente" />
          <Metric label="Início da obra" value={formatDate(work.data_inicio, company.locale)} note="data de mobilização" />
          <Metric label="Entrega prevista" value={formatDate(work.data_fim_prevista, company.locale)} note="cronograma linear inicial" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Avanço físico" value={`${formatNumber(progress, company.locale, { maximumFractionDigits: 1 })}%`} detail="conforme produção registrada" percent={progress} accent="emerald" />
        <SummaryCard label="Orçamento EAP" value={formatCurrency(summary?.orcado_total, company.locale, company.moeda)} detail="serviços planejados" />
        <SummaryCard label="Custos realizados" value={formatCurrency(summary?.custo_realizado, company.locale, company.moeda)} detail="lançamentos da obra" accent="amber" />
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><UsersRound size={17} className="text-slate-400" /> Equipe da obra</h2>
            <p className="mt-1 text-xs text-slate-500">Pessoas vinculadas a esta frente de trabalho.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{memberIds.length}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {memberIds.map((memberId) => {
            const profile = profileById.get(memberId);
            return (
              <div key={memberId} className="flex items-center gap-3 px-5 py-4 sm:px-7">
                <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {(profile?.nome ?? profile?.email ?? "?").slice(0, 1).toLocaleUpperCase("pt-BR")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{profile?.nome ?? "Membro da obra"}</p>
                  <p className="truncate text-xs text-slate-400">{profile?.email ?? ""}</p>
                </div>
              </div>
            );
          })}
          {!memberIds.length && <p className="px-7 py-8 text-sm text-slate-500">Nenhum membro vinculado a esta obra.</p>}
        </div>
        {perfil === "diretor" && availableMembers.length > 0 && (
          <WorkMemberForm
            workId={work.id}
            members={availableMembers.map((member) => {
              const profile = profileById.get(member.usuario_id);
              return {
                userId: member.usuario_id,
                label: `${profile?.nome ?? profile?.email ?? member.usuario_id} · ${member.perfil}`,
              };
            })}
          />
        )}
        {perfil === "diretor" && availableMembers.length === 0 && (
          <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:px-7">
            Adicione pessoas em <Link href="/app/membros" className="font-semibold text-emerald-800 hover:underline">Membros da empresa</Link> para vinculá-las a esta obra.
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-900">
        <CalendarDays size={16} className="shrink-0" />
        O cronograma exibido é uma referência linear entre as datas da obra. O cronograma detalhado por EAP será disponibilizado em breve.
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-base font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  percent,
  accent = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  percent?: number;
  accent?: "slate" | "emerald" | "amber";
}) {
  const bar = accent === "emerald" ? "bg-emerald-600" : accent === "amber" ? "bg-amber-500" : "bg-slate-300";
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white p-5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-3 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {percent !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }} />
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">{detail}</p>
    </article>
  );
}
