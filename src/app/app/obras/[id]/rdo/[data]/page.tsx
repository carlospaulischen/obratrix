import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RdoEditor, type RdoPhoto, type RdoService } from "@/components/rdo/rdo-editor";
import { WorkTabs } from "@/components/orcamento/work-tabs";
import { getCompanyContext } from "@/lib/company";
import { compareCodigoNatural } from "@/lib/orcamento/parse-planilha";
import { dataHoje, dataIsoValida } from "@/lib/rdo/data";
import { emptyRdoPayload, type RdoPayloadForm } from "@/lib/rdo/schema";

export default async function RdoDetailPage({
  params,
}: {
  params: Promise<{ id: string; data: string }>;
}) {
  const { id, data: date } = await params;
  if (!dataIsoValida(date) || date > dataHoje()) notFound();
  const { supabase, company, perfil } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) notFound();

  const { data: rdo } = await supabase
    .from("obx_rdos")
    .select("*")
    .eq("obra_id", work.id)
    .eq("data", date)
    .maybeSingle();
  const rdoId = rdo?.id ?? null;
  const childQueries = rdoId
    ? await Promise.all([
      supabase.from("obx_rdo_mao_obra").select("*").eq("rdo_id", rdoId),
      supabase.from("obx_rdo_producao").select("*").eq("rdo_id", rdoId),
      supabase.from("obx_rdo_equipamentos").select("*").eq("rdo_id", rdoId),
      supabase.from("obx_rdo_materiais").select("*").eq("rdo_id", rdoId),
      supabase.from("obx_rdo_ocorrencias").select("*").eq("rdo_id", rdoId),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const [laborResult, productionResult, equipmentResult, materialResult, occurrenceResult] = childQueries;

  const { data: serviceRows } = await supabase
    .from("obx_eap_itens")
    .select("id,codigo,descricao,unidade,quantidade")
    .eq("obra_id", work.id)
    .eq("tipo", "servico");
  const servicesForForm: RdoService[] = (serviceRows ?? [])
    .map((service) => ({
      id: service.id,
      codigo: service.codigo,
      descricao: service.descricao,
      unidade: service.unidade,
      quantidade: Number(service.quantidade),
      executada: 0,
    }))
    .sort((a, b) => compareCodigoNatural(a.codigo, b.codigo));

  const { data: obraRdos } = await supabase
    .from("obx_rdos")
    .select("id")
    .eq("obra_id", work.id);
  const previousRdoIds = (obraRdos ?? [])
    .filter((entry) => entry.id !== rdoId)
    .map((entry) => entry.id);
  const { data: previousProduction } = previousRdoIds.length
    ? await supabase
      .from("obx_rdo_producao")
      .select("eap_item_id,quantidade")
      .in("rdo_id", previousRdoIds)
    : { data: [] };
  const executedByService = new Map<string, number>();
  for (const entry of previousProduction ?? []) {
    executedByService.set(
      entry.eap_item_id,
      (executedByService.get(entry.eap_item_id) ?? 0) + Number(entry.quantidade),
    );
  }
  const services: RdoService[] = servicesForForm.map((service) => ({
    ...service,
    executada: executedByService.get(service.id) ?? 0,
  }));

  let photos: RdoPhoto[] = [];
  if (rdoId) {
    const { data: photoRows } = await supabase
      .from("obx_fotos")
      .select("id,storage_path,legenda")
      .eq("rdo_id", rdoId)
      .order("created_at");
    const signedPhotos = await Promise.all((photoRows ?? []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from("obx_fotos")
        .createSignedUrl(photo.storage_path, 3600);
      return signed ? { ...photo, url: signed.signedUrl } : null;
    }));
    photos = signedPhotos.filter((photo): photo is RdoPhoto => photo !== null);
  }

  const { data: canEditExisting } = rdoId
    ? await supabase.rpc("obx_fn_pode_editar_rdo", { p_rdo_id: rdoId })
    : await supabase.rpc("obx_fn_pode_registrar_campo", { p_obra_id: work.id });
  const canConfirm = Boolean(canEditExisting) && (perfil === "diretor" || perfil === "engenheiro");
  const canEdit = Boolean(canEditExisting) && rdo?.status !== "confirmado";

  const initialPayload: RdoPayloadForm = rdo
    ? {
      clima_manha: rdo.clima_manha,
      clima_tarde: rdo.clima_tarde,
      observacoes: rdo.observacoes ?? "",
      mao_obra: (laborResult.data ?? []).map((line) => ({
        funcao: line.funcao,
        quantidade: Number(line.quantidade),
        horas: Number(line.horas),
      })),
      producao: (productionResult.data ?? []).map((line) => ({
        eap_item_id: line.eap_item_id,
        quantidade: Number(line.quantidade),
        observacao: line.observacao ?? "",
      })),
      equipamentos: (equipmentResult.data ?? []).map((line) => ({
        equipamento: line.equipamento,
        horas_trabalhadas: Number(line.horas_trabalhadas),
        horas_paradas: Number(line.horas_paradas),
        motivo_parada: line.motivo_parada ?? "",
      })),
      materiais: (materialResult.data ?? []).map((line) => ({
        material: line.material,
        quantidade: Number(line.quantidade),
        unidade: line.unidade,
      })),
      ocorrencias: (occurrenceResult.data ?? []).map((line) => ({
        tipo: line.tipo,
        descricao: line.descricao,
        hora_inicio: line.hora_inicio ?? "",
        hora_fim: line.hora_fim ?? "",
      })),
    }
    : emptyRdoPayload();

  return (
    <div className="space-y-6">
      <WorkTabs workId={work.id} active="rdo" />
      <Link href={`/app/obras/${work.id}/rdo`} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-800">
        <ArrowLeft size={15} /> Lista de RDOs
      </Link>
      <RdoEditor
        workId={work.id}
        workName={`${work.codigo} · ${work.nome}`}
        date={date}
        initialRdoId={rdoId}
        initialPayload={initialPayload}
        initialPhotos={photos}
        services={services}
        canEdit={canEdit}
        canConfirm={canConfirm}
        confirmed={rdo?.status === "confirmado"}
      />
    </div>
  );
}
