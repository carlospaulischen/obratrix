import { notFound } from "next/navigation";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { SemanalManager } from "@/components/semanal/semanal-manager";
import { getCompanyContext } from "@/lib/company";
import { dataHoje } from "@/lib/rdo/data";

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export default async function WorkSemanalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const [{ data: services }, { data: planos }, { data: rdos }, { data: canEdit }, { data: canViewCosts }] =
    await Promise.all([
      supabase
        .from("obx_eap_itens")
        .select("id,codigo,descricao,unidade,quantidade,inicio_previsto,fim_previsto")
        .eq("obra_id", id)
        .eq("tipo", "servico"),
      supabase
        .from("obx_planos_semanais")
        .select("id,semana_inicio,status")
        .eq("obra_id", id)
        .order("semana_inicio", { ascending: false }),
      supabase.from("obx_rdos").select("id,data").eq("obra_id", id).eq("status", "confirmado"),
      supabase.rpc("obx_fn_pode_editar_obra", { p_obra_id: id }),
      supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: id }),
    ]);

  const planoIds = (planos ?? []).map((plano) => plano.id);
  const { data: planoItens } = planoIds.length
    ? await supabase
        .from("obx_plano_semanal_itens")
        .select("plano_id,eap_item_id,quantidade_planejada")
        .in("plano_id", planoIds)
    : { data: [] };

  const rdoIds = (rdos ?? []).map((rdo) => rdo.id);
  const { data: production } = rdoIds.length
    ? await supabase.from("obx_rdo_producao").select("rdo_id,eap_item_id,quantidade").in("rdo_id", rdoIds)
    : { data: [] };
  const rdoDataById = new Map((rdos ?? []).map((rdo) => [rdo.id, rdo.data]));
  const executadoTotal = new Map<string, number>();
  for (const entry of production ?? []) {
    executadoTotal.set(entry.eap_item_id, (executadoTotal.get(entry.eap_item_id) ?? 0) + Number(entry.quantidade));
  }

  const itensByPlano = new Map<string, typeof planoItens>();
  for (const item of planoItens ?? []) {
    const list = itensByPlano.get(item.plano_id) ?? [];
    list.push(item);
    itensByPlano.set(item.plano_id, list);
  }

  const planosEnriquecidos = (planos ?? []).map((plano) => {
    const inicio = plano.semana_inicio;
    const fim = addDays(inicio, 6);
    const itens = (itensByPlano.get(plano.id) ?? []).map((item) => {
      const executado = (production ?? [])
        .filter((entry) => {
          const data = rdoDataById.get(entry.rdo_id);
          return entry.eap_item_id === item.eap_item_id && data !== undefined && data >= inicio && data <= fim;
        })
        .reduce((sum, entry) => sum + Number(entry.quantidade), 0);
      return { eapItemId: item.eap_item_id, quantidadePlanejada: Number(item.quantidade_planejada), executado };
    });
    const cumpridos = itens.filter((item) => item.executado >= item.quantidadePlanejada).length;
    return {
      id: plano.id,
      semanaInicio: inicio,
      semanaFim: fim,
      status: plano.status as "aberto" | "fechado",
      itens,
      ppc: itens.length ? cumpridos / itens.length : null,
    };
  });

  const hoje = dataHoje(company.fuso_horario);

  return (
    <div className="space-y-7">
      <WorkTabs workId={work.id} active="semanal" showCosts={Boolean(canViewCosts)} />
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">{work.codigo} · Planejamento semanal</p>
        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{work.nome}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Plano semanal de serviços e PPC: percentual de itens planejados que a produção confirmada no RDO cumpriu na semana.
        </p>
      </header>
      <SemanalManager
        workId={work.id}
        services={(services ?? []).map((service) => ({
          id: service.id,
          codigo: service.codigo,
          descricao: service.descricao,
          unidade: service.unidade,
          quantidade: Number(service.quantidade),
          executado: executadoTotal.get(service.id) ?? 0,
          inicioPrevisto: service.inicio_previsto,
          fimPrevisto: service.fim_previsto,
        }))}
        planos={planosEnriquecidos}
        canEdit={Boolean(canEdit)}
        hoje={hoje}
        locale={company.locale}
      />
    </div>
  );
}
