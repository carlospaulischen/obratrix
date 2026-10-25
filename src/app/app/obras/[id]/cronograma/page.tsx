import { notFound } from "next/navigation";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { CronogramaBoard } from "@/components/cronograma/cronograma-board";
import { getCompanyContext } from "@/lib/company";
import { dataHoje } from "@/lib/rdo/data";

function compareCodigo(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

export default async function WorkCronogramaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,data_inicio,data_fim_prevista")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const [{ data: sourceItems }, { data: rdos }, { data: canEdit }, { data: canViewCosts }] =
    await Promise.all([
      supabase
        .from("obx_eap_itens")
        .select("id,codigo,parent_id,descricao,tipo,unidade,quantidade,inicio_previsto,fim_previsto")
        .eq("obra_id", id),
      supabase.from("obx_rdos").select("id").eq("obra_id", id).eq("status", "confirmado"),
      supabase.rpc("obx_fn_pode_editar_obra", { p_obra_id: id }),
      supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: id }),
    ]);
  const rdoIds = (rdos ?? []).map((rdo) => rdo.id);
  const { data: production } = rdoIds.length
    ? await supabase.from("obx_rdo_producao").select("eap_item_id,quantidade").in("rdo_id", rdoIds)
    : { data: [] };
  const executedByItem = new Map<string, number>();
  for (const entry of production ?? []) {
    executedByItem.set(entry.eap_item_id, (executedByItem.get(entry.eap_item_id) ?? 0) + Number(entry.quantidade));
  }

  const items = [...(sourceItems ?? [])].sort((a, b) => compareCodigo(a.codigo, b.codigo));
  const hoje = dataHoje(company.fuso_horario);
  const services = items.filter((item) => item.tipo === "servico");
  const planejados = services.filter((item) => item.inicio_previsto && item.fim_previsto).length;

  return (
    <div className="space-y-7">
      <WorkTabs workId={work.id} active="cronograma" showCosts={Boolean(canViewCosts)} />
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">{work.codigo} · Cronograma por EAP</p>
        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{work.nome}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Janela prevista de cada serviço da EAP. {canEdit ? "Edite as datas e salve para recalcular o planejado (PV)." : "Apenas diretor e engenheiro da obra editam as datas."}
          {planejados > 0 ? ` ${planejados} de ${services.length} serviços com janela definida.` : " Nenhum serviço com janela definida — o planejado usa a linha reta da obra."}
        </p>
      </header>
      <CronogramaBoard
        workId={work.id}
        items={items.map((item) => ({
          id: item.id,
          codigo: item.codigo,
          descricao: item.descricao,
          tipo: item.tipo,
          unidade: item.unidade,
          quantidade: Number(item.quantidade),
          inicioPrevisto: item.inicio_previsto,
          fimPrevisto: item.fim_previsto,
          executado: executedByItem.get(item.id) ?? 0,
        }))}
        obraInicio={work.data_inicio}
        obraFim={work.data_fim_prevista}
        hoje={hoje}
        canEdit={Boolean(canEdit)}
        locale={company.locale}
      />
    </div>
  );
}
