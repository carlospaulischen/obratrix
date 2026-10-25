"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCompanyContext } from "@/lib/company";
import { dataHoje, dataIsoValida } from "@/lib/rdo/data";
import type { CategoriaCusto } from "@/lib/custos/parse-planilha";

export type CostActionResult = { error?: string; success?: string };

const costSchema = z.object({
  obraId: z.string().uuid(),
  id: z.string().uuid().optional(),
  data: z.string(),
  descricao: z.string().trim().min(1, "Informe a descrição."),
  categoria: z.enum(["mao_obra", "material", "equipamento", "servico_terceiro", "indireto"]),
  valor: z.number().finite().positive("O valor deve ser maior que zero."),
  fornecedor: z.string().trim(),
  documento: z.string().trim(),
  eapItemId: z.string().uuid().nullable(),
  centroCustoId: z.string().uuid().nullable(),
});

export async function saveCostAction(input: unknown): Promise<CostActionResult> {
  const parsed = costSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do custo." };

  const { supabase, company, user } = await getCompanyContext();
  if (!dataIsoValida(parsed.data.data)) return { error: "Informe uma data válida." };
  if (parsed.data.data > dataHoje(company.fuso_horario)) return { error: "A data do custo não pode ser futura." };

  const { data: canEdit } = await supabase.rpc("obx_fn_pode_editar_custo", {
    p_obra_id: parsed.data.obraId,
  });
  if (!canEdit) return { error: "Você não tem permissão para editar custos nesta obra." };
  const { data: work } = await supabase.from("obx_obras").select("id")
    .eq("id", parsed.data.obraId).eq("empresa_id", company.id).maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  if (parsed.data.eapItemId) {
    const { data: service } = await supabase.from("obx_eap_itens").select("id")
      .eq("id", parsed.data.eapItemId).eq("obra_id", work.id).eq("tipo", "servico").maybeSingle();
    if (!service) return { error: "Selecione um serviço da lista desta obra." };
  }
  if (parsed.data.centroCustoId) {
    const { data: center } = await supabase.from("obx_centros_custo").select("id")
      .eq("id", parsed.data.centroCustoId).eq("empresa_id", company.id).maybeSingle();
    if (!center) return { error: "Centro de custo não pertence à empresa ativa." };
  }

  const fields = {
    obra_id: work.id,
    eap_item_id: parsed.data.eapItemId,
    centro_custo_id: parsed.data.centroCustoId,
    categoria: parsed.data.categoria as CategoriaCusto,
    descricao: parsed.data.descricao,
    fornecedor: parsed.data.fornecedor || null,
    documento: parsed.data.documento || null,
    data: parsed.data.data,
    valor: parsed.data.valor,
  };
  const result = parsed.data.id
    ? await supabase.from("obx_custos").update(fields).eq("id", parsed.data.id).eq("obra_id", work.id)
    : await supabase.from("obx_custos").insert({ ...fields, criado_por: user.id });
  if (result.error) return { error: "Não foi possível salvar o lançamento." };
  revalidatePath(`/app/obras/${work.id}/custos`);
  revalidatePath(`/app/obras/${work.id}`);
  revalidatePath("/app");
  return { success: "Lançamento salvo." };
}

export async function deleteCostAction(input: unknown): Promise<CostActionResult> {
  const parsed = z.object({ obraId: z.string().uuid(), id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Selecione um lançamento válido." };
  const { supabase, company } = await getCompanyContext();
  const { data: canEdit } = await supabase.rpc("obx_fn_pode_editar_custo", {
    p_obra_id: parsed.data.obraId,
  });
  if (!canEdit) return { error: "Você não tem permissão para excluir custos nesta obra." };
  const { data: work } = await supabase.from("obx_obras").select("id")
    .eq("id", parsed.data.obraId).eq("empresa_id", company.id).maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };
  const { error } = await supabase.from("obx_custos").delete()
    .eq("id", parsed.data.id).eq("obra_id", work.id);
  if (error) return { error: "Não foi possível excluir o lançamento." };
  revalidatePath(`/app/obras/${work.id}/custos`);
  revalidatePath(`/app/obras/${work.id}`);
  revalidatePath("/app");
  return { success: "Lançamento excluído." };
}
