"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCompanyContext } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { dataHoje, dataIsoValida, inicioDaSemana } from "@/lib/rdo/data";
import { rdoPayloadSchema } from "@/lib/rdo/schema";
import { carregarIndicadoresObras } from "@/lib/indicadores/carregar";

export type ActionState = { error?: string; success?: string };

const eapItemSchema = z.object({
  obraId: z.string().uuid(),
  id: z.string().uuid().optional(),
  codigo: z.string().trim().regex(/^\d+(?:\.\d+)*$/, "Informe um código válido."),
  descricao: z.string().trim().min(1, "Informe a descrição."),
  tipo: z.enum(["etapa", "servico"]),
  unidade: z.string().trim().nullable(),
  quantidade: z.number().finite().nonnegative(),
  custoUnitario: z.number().finite().nonnegative(),
  centroCustoId: z.string().uuid().nullable(),
});

export async function saveEapItemAction(input: unknown): Promise<ActionState> {
  const parsed = eapItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confira os dados do item." };
  }

  const { supabase, company } = await getCompanyContext();
  const { data: canEdit } = await supabase.rpc("obx_fn_pode_editar_obra", {
    p_obra_id: parsed.data.obraId,
  });
  if (!canEdit) return { error: "Você não tem permissão para editar esta EAP." };

  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", parsed.data.obraId)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  const parentCode = parsed.data.codigo.includes(".")
    ? parsed.data.codigo.slice(0, parsed.data.codigo.lastIndexOf("."))
    : null;
  let parentId: string | null = null;
  if (parentCode) {
    const { data: parent } = await supabase
      .from("obx_eap_itens")
      .select("id")
      .eq("obra_id", parsed.data.obraId)
      .eq("codigo", parentCode)
      .maybeSingle();
    if (!parent) return { error: `A etapa pai ${parentCode} não existe nesta obra.` };
    parentId = parent.id;
  }

  if (parsed.data.id) {
    const { data: current } = await supabase
      .from("obx_eap_itens")
      .select("id")
      .eq("id", parsed.data.id)
      .eq("obra_id", parsed.data.obraId)
      .maybeSingle();
    if (!current) return { error: "Item não encontrado nesta obra." };
    const { data: children } = await supabase
      .from("obx_eap_itens")
      .select("id")
      .eq("parent_id", parsed.data.id)
      .limit(1);
    if (children?.length && parsed.data.tipo !== "etapa") {
      return { error: "Um item com filhos precisa continuar como etapa." };
    }
  }

  if (parsed.data.centroCustoId) {
    const { data: center } = await supabase
      .from("obx_centros_custo")
      .select("id")
      .eq("id", parsed.data.centroCustoId)
      .eq("empresa_id", company.id)
      .maybeSingle();
    if (!center) return { error: "Centro de custo não pertence à empresa ativa." };
  }

  const fields = {
    obra_id: parsed.data.obraId,
    parent_id: parentId,
    codigo: parsed.data.codigo,
    descricao: parsed.data.descricao,
    tipo: parsed.data.tipo,
    unidade: parsed.data.unidade || null,
    quantidade: parsed.data.quantidade,
    custo_unitario: parsed.data.custoUnitario,
    centro_custo_id: parsed.data.centroCustoId,
  };
  const result = parsed.data.id
    ? await supabase
      .from("obx_eap_itens")
      .update(fields)
      .eq("id", parsed.data.id)
      .eq("obra_id", parsed.data.obraId)
    : await supabase.from("obx_eap_itens").insert(fields);
  if (result.error) return { error: "Não foi possível salvar o item da EAP." };

  revalidatePath(`/app/obras/${parsed.data.obraId}/orcamento`);
  return { success: "Item salvo." };
}

const deleteEapItemSchema = z.object({
  obraId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export async function deleteEapItemAction(input: unknown): Promise<ActionState> {
  const parsed = deleteEapItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Selecione um item válido." };
  const { supabase } = await getCompanyContext();
  const { data: canEdit } = await supabase.rpc("obx_fn_pode_editar_obra", {
    p_obra_id: parsed.data.obraId,
  });
  if (!canEdit) return { error: "Você não tem permissão para editar esta EAP." };

  const { data: items } = await supabase
    .from("obx_eap_itens")
    .select("id,codigo")
    .eq("obra_id", parsed.data.obraId);
  const selected = items?.find((item) => item.id === parsed.data.itemId);
  if (!selected) return { error: "Item não encontrado nesta obra." };
  const affectedIds = (items ?? [])
    .filter((item) =>
      item.id === selected.id || item.codigo.startsWith(`${selected.codigo}.`)
    )
    .map((item) => item.id);
  const { data: production } = await supabase
    .from("obx_rdo_producao")
    .select("id")
    .in("eap_item_id", affectedIds)
    .limit(1)
    .maybeSingle();
  if (production) {
    return { error: "Não é possível excluir: este item ou um de seus filhos tem produção registrada." };
  }

  const { error } = await supabase
    .from("obx_eap_itens")
    .delete()
    .eq("id", selected.id)
    .eq("obra_id", parsed.data.obraId);
  if (error) return { error: "Não foi possível excluir o item da EAP." };
  revalidatePath(`/app/obras/${parsed.data.obraId}/orcamento`);
  return { success: "Item excluído." };
}

const emailSchema = z.string().trim().email("Informe um e-mail válido.");
const passwordSchema = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.");

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!email.success || !password.success) {
    return { error: email.error?.issues[0]?.message ?? password.error?.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  if (error) return { error: "E-mail ou senha incorretos. Confira os dados e tente novamente." };

  const { company } = await getCompanyContext();
  const cookieStore = await cookies();
  cookieStore.set("obx_empresa_id", company.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  cookieStore.set("obx_locale", company.locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  const requestedPath = formData.get("next");
  const nextPath = typeof requestedPath === "string" && requestedPath.startsWith("/app")
    ? requestedPath
    : "/app";
  redirect(nextPath);
}

export async function signupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const nome = z.string().trim().min(2, "Informe seu nome.").safeParse(formData.get("nome"));
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!nome.success || !email.success || !password.success) {
    return {
      error: nome.error?.issues[0]?.message
        ?? email.error?.issues[0]?.message
        ?? password.error?.issues[0]?.message,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: { data: { nome: nome.data } },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    return { success: "Conta criada. Confira sua caixa de e-mail para confirmar o cadastro." };
  }
  redirect("/onboarding");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createCompanyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const nome = z.string().trim().min(2, "Informe o nome da empresa.").safeParse(formData.get("nome"));
  const cnpj = z.string().trim().optional().safeParse(formData.get("cnpj") || undefined);
  if (!nome.success || !cnpj.success) {
    return { error: nome.error?.issues[0]?.message ?? cnpj.error?.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companyId, error } = await supabase.rpc("obx_fn_criar_empresa", {
    p_nome: nome.data,
    p_cnpj: cnpj.data,
  });
  if (error || !companyId) {
    return { error: "Não foi possível criar a empresa. Tente novamente." };
  }

  const cookieStore = await cookies();
  cookieStore.set("obx_empresa_id", companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  cookieStore.set("obx_locale", "pt-BR", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/app");
}

export async function setActiveCompanyAction(formData: FormData) {
  const companyId = formData.get("empresa_id");
  if (typeof companyId !== "string") redirect("/app");

  const { supabase, user, companies } = await getCompanyContext();
  const { data: membership } = await supabase
    .from("obx_empresa_membros")
    .select("empresa_id")
    .eq("empresa_id", companyId)
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/app");

  const cookieStore = await cookies();
  cookieStore.set("obx_empresa_id", companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  const company = companies.find((entry) => entry.id === companyId);
  cookieStore.set("obx_locale", company?.locale ?? "pt-BR", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/app");
}

const obraSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().trim().min(2, "Informe um código."),
  nome: z.string().trim().min(2, "Informe o nome da obra."),
  cliente: z.string().trim().optional(),
  endereco: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  uf: z.string().trim().max(2).optional(),
  data_inicio: z.string().optional(),
  data_fim_prevista: z.string().optional(),
  valor_contrato: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? null : Number(value),
    z.number().nonnegative().nullable(),
  ),
  status: z.enum(["planejamento", "em_andamento", "paralisada", "concluida"]),
});

export async function saveWorkAction(input: unknown): Promise<ActionState> {
  const parsed = obraSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos da obra." };
  const { supabase, company } = await getCompanyContext();
  const { id, ...fields } = parsed.data;
  const workFields = {
    ...fields,
    empresa_id: company.id,
    cliente: fields.cliente || null,
    endereco: fields.endereco || null,
    cidade: fields.cidade || null,
    uf: fields.uf?.toUpperCase() || null,
    data_inicio: fields.data_inicio || null,
    data_fim_prevista: fields.data_fim_prevista || null,
  };

  if (id) {
    const { error } = await supabase
      .from("obx_obras")
      .update(workFields)
      .eq("id", id)
      .eq("empresa_id", company.id);
    if (error) return { error: "Não foi possível atualizar a obra." };
    redirect(`/app/obras/${id}`);
  }

  const { data, error } = await supabase
    .from("obx_obras")
    .insert(workFields)
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar a obra. Verifique o código e tente novamente." };
  redirect(`/app/obras/${data.id}`);
}

export async function addWorkMemberAction(previousState: ActionState, formData: FormData): Promise<ActionState> {
  void previousState;
  const obraId = z.string().uuid().safeParse(formData.get("obra_id"));
  const usuarioId = z.string().uuid().safeParse(formData.get("usuario_id"));
  if (!obraId.success || !usuarioId.success) return { error: "Selecione um membro válido." };

  const { supabase, company, perfil } = await getCompanyContext();
  if (perfil !== "diretor") return { error: "Somente o diretor pode gerenciar membros da obra." };
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", obraId.data)
    .eq("empresa_id", company.id)
    .maybeSingle();
  const { data: companyMember } = await supabase
    .from("obx_empresa_membros")
    .select("usuario_id")
    .eq("empresa_id", company.id)
    .eq("usuario_id", usuarioId.data)
    .maybeSingle();
  if (!work || !companyMember) return { error: "A obra ou o membro não pertence à empresa ativa." };

  const { error } = await supabase
    .from("obx_obra_membros")
    .upsert({ obra_id: obraId.data, usuario_id: usuarioId.data }, { onConflict: "obra_id,usuario_id" });
  if (error) return { error: "Não foi possível adicionar o membro à obra." };
  redirect(`/app/obras/${obraId.data}`);
}

export async function updateMemberProfileAction(previousState: ActionState, formData: FormData): Promise<ActionState> {
  void previousState;
  const usuarioId = z.string().uuid().safeParse(formData.get("usuario_id"));
  const perfil = z.enum(["diretor", "engenheiro", "encarregado", "financeiro"])
    .safeParse(formData.get("perfil"));
  if (!usuarioId.success || !perfil.success) return { error: "Selecione um perfil válido." };

  const { supabase, company, perfil: currentProfile } = await getCompanyContext();
  if (currentProfile !== "diretor") return { error: "Somente o diretor pode alterar perfis." };
  const { error } = await supabase
    .from("obx_empresa_membros")
    .update({ perfil: perfil.data })
    .eq("empresa_id", company.id)
    .eq("usuario_id", usuarioId.data);
  if (error) return { error: "Não foi possível atualizar o perfil do membro." };
  redirect("/app/membros");
}

const rdoSaveRequestSchema = z.object({
  obraId: z.string().uuid(),
  data: z.string().refine(dataIsoValida, "Informe uma data válida."),
  payload: z.unknown(),
});

const rdoIdRequestSchema = z.object({
  obraId: z.string().uuid(),
  rdoId: z.string().uuid(),
});

export async function saveRdoAction(input: unknown): Promise<ActionState & { rdoId?: string }> {
  const request = rdoSaveRequestSchema.safeParse(input);
  if (!request.success) return { error: request.error.issues[0]?.message ?? "Confira os dados do RDO." };
  const payload = rdoPayloadSchema.safeParse(request.data.payload);
  if (!payload.success) return { error: payload.error.issues[0]?.message ?? "Confira os campos do RDO." };

  const { supabase, company } = await getCompanyContext();
  if (request.data.data > dataHoje(company.fuso_horario)) {
    return { error: "Não é possível registrar um RDO em uma data futura." };
  }
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", request.data.obraId)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  const { data: rdoId, error } = await supabase.rpc("obx_fn_salvar_rdo", {
    p_obra_id: work.id,
    p_data: request.data.data,
    p_payload: payload.data,
  });
  if (error || !rdoId) {
    return {
      error: error?.message.includes("confirmado")
        ? "Este RDO está confirmado. Somente diretor ou engenheiro pode alterá-lo."
        : error?.message.includes("futura")
          ? "Não é possível registrar um RDO em uma data futura."
          : "Não foi possível salvar o RDO. Verifique sua permissão e tente novamente.",
    };
  }

  revalidatePath(`/app/obras/${work.id}`);
  revalidatePath(`/app/obras/${work.id}/rdo`);
  revalidatePath(`/app/obras/${work.id}/rdo/${request.data.data}`);
  revalidatePath(`/app/obras/${work.id}/orcamento`);
  return { success: "Rascunho salvo.", rdoId };
}

async function updateRdoStatus(input: unknown, status: "rascunho" | "confirmado"): Promise<ActionState> {
  const request = rdoIdRequestSchema.safeParse(input);
  if (!request.success) return { error: "Selecione um RDO válido." };
  const { supabase, company, perfil, user } = await getCompanyContext();
  if (perfil !== "diretor" && perfil !== "engenheiro") {
    return { error: "Somente diretor ou engenheiro pode confirmar ou reabrir o RDO." };
  }
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", request.data.obraId)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  const { data: canEdit } = await supabase.rpc("obx_fn_pode_editar_rdo", {
    p_rdo_id: request.data.rdoId,
  });
  if (!canEdit) return { error: "Você não tem permissão para alterar este RDO." };

  const { error } = await supabase
    .from("obx_rdos")
    .update(status === "confirmado"
      ? { status, confirmado_por: user.id, confirmado_em: new Date().toISOString() }
      : { status, confirmado_por: null, confirmado_em: null })
    .eq("id", request.data.rdoId)
    .eq("obra_id", work.id);
  if (error) return { error: "Não foi possível atualizar o status do RDO." };

  revalidatePath(`/app/obras/${work.id}`);
  revalidatePath(`/app/obras/${work.id}/rdo`);
  revalidatePath("/app/obras/[id]/rdo", "page");
  revalidatePath("/app/obras/[id]/rdo/[data]", "page");
  revalidatePath(`/app/obras/${work.id}/orcamento`);
  return { success: status === "confirmado" ? "RDO confirmado." : "RDO reaberto como rascunho." };
}

export async function confirmRdoAction(input: unknown) {
  return updateRdoStatus(input, "confirmado");
}

export async function reopenRdoAction(input: unknown) {
  return updateRdoStatus(input, "rascunho");
}

const rdoPhotoIdSchema = z.object({ id: z.string().uuid() });

export async function deleteRdoPhotoAction(input: unknown): Promise<ActionState> {
  const parsed = rdoPhotoIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Selecione uma foto válida." };
  const { supabase } = await getCompanyContext();
  const { data: photo } = await supabase
    .from("obx_fotos")
    .select("id,obra_id,rdo_id,storage_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!photo?.rdo_id) return { error: "Foto não encontrada em um RDO." };

  const [{ data: rdo }, { data: canRegister }] = await Promise.all([
    supabase.from("obx_rdos").select("status").eq("id", photo.rdo_id).maybeSingle(),
    supabase.rpc("obx_fn_pode_registrar_campo", { p_obra_id: photo.obra_id }),
  ]);
  if (!canRegister || rdo?.status !== "rascunho") {
    return { error: "Apenas fotos de RDO em rascunho podem ser excluídas." };
  }
  const { error: storageError } = await supabase.storage.from("obx_fotos").remove([photo.storage_path]);
  if (storageError) return { error: "Não foi possível remover o arquivo da foto." };
  const { error } = await supabase.from("obx_fotos").delete().eq("id", photo.id);
  if (error) return { error: "Não foi possível excluir o registro da foto." };

  revalidatePath(`/app/obras/${photo.obra_id}/rdo`);
  return { success: "Foto excluída." };
}

const cronogramaSchema = z.object({
  obraId: z.string().uuid(),
  itens: z.array(
    z.object({
      id: z.string().uuid(),
      inicioPrevisto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      fimPrevisto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    }),
  ).max(2000),
});

export async function saveCronogramaAction(input: unknown): Promise<ActionState> {
  const parsed = cronogramaSchema.safeParse(input);
  if (!parsed.success) return { error: "Confira as datas informadas." };

  const { supabase, company } = await getCompanyContext();
  const { data: canEdit } = await supabase.rpc("obx_fn_pode_editar_obra", {
    p_obra_id: parsed.data.obraId,
  });
  if (!canEdit) return { error: "Você não tem permissão para editar o cronograma desta obra." };

  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", parsed.data.obraId)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  const { data: items } = await supabase
    .from("obx_eap_itens")
    .select("id")
    .eq("obra_id", parsed.data.obraId)
    .eq("tipo", "servico");
  const validIds = new Set((items ?? []).map((item) => item.id));
  if (parsed.data.itens.some((item) => !validIds.has(item.id))) {
    return { error: "Há serviços que não pertencem a esta obra." };
  }
  for (const item of parsed.data.itens) {
    if (item.inicioPrevisto && item.fimPrevisto && item.fimPrevisto < item.inicioPrevisto) {
      return { error: "O fim previsto não pode ser anterior ao início." };
    }
  }

  const results = await Promise.all(
    parsed.data.itens.map((item) =>
      supabase
        .from("obx_eap_itens")
        .update({ inicio_previsto: item.inicioPrevisto, fim_previsto: item.fimPrevisto })
        .eq("id", item.id)
        .eq("obra_id", parsed.data.obraId)
    ),
  );
  if (results.some((result) => result.error)) {
    return { error: "Não foi possível salvar o cronograma." };
  }

  revalidatePath(`/app/obras/${parsed.data.obraId}/cronograma`);
  revalidatePath(`/app/obras/${parsed.data.obraId}`);
  return { success: "Cronograma salvo." };
}

const planoSemanalSchema = z.object({
  obraId: z.string().uuid(),
  semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itens: z.array(
    z.object({
      eapItemId: z.string().uuid(),
      quantidadePlanejada: z.number().finite().positive(),
    }),
  ).max(500),
});

export async function savePlanoSemanalAction(input: unknown): Promise<ActionState> {
  const parsed = planoSemanalSchema.safeParse(input);
  if (!parsed.success) return { error: "Confira os itens do plano semanal." };

  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", parsed.data.obraId)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  const monday = new Date(`${parsed.data.semanaInicio}T00:00:00.000Z`);
  if (monday.getUTCDay() !== 1) return { error: "A semana deve começar numa segunda-feira." };

  const { error } = await supabase.rpc("obx_fn_salvar_plano_semanal", {
    p_obra_id: parsed.data.obraId,
    p_semana_inicio: parsed.data.semanaInicio,
    p_itens: parsed.data.itens.map((item) => ({
      eap_item_id: item.eapItemId,
      quantidade_planejada: item.quantidadePlanejada,
    })),
  });
  if (error) {
    return { error: error.message.includes("permissão") ? error.message : "Não foi possível salvar o plano semanal." };
  }

  revalidatePath(`/app/obras/${parsed.data.obraId}/semanal`);
  return { success: "Plano semanal salvo." };
}

const perguntaSchema = z.object({
  obraId: z.string().uuid(),
  pergunta: z.string().trim().min(3, "Faça uma pergunta.").max(500, "Pergunta muito longa."),
});

export async function askObraAction(input: unknown): Promise<{ error?: string; resposta?: string }> {
  const parsed = perguntaSchema.safeParse(input);
  if (!parsed.success) return { error: "Faça uma pergunta sobre a obra." };

  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id,codigo,nome,status,data_inicio,data_fim_prevista,valor_contrato")
    .eq("id", parsed.data.obraId)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  const { data: canView } = await supabase.rpc("obx_fn_pode_ver_obra", { p_obra_id: work.id });
  if (!canView) return { error: "Você não tem permissão para ver esta obra." };
  const { data: canViewCosts } = await supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: work.id });

  const hoje = dataHoje(company.fuso_horario);
  const [indicators] = await carregarIndicadoresObras(supabase, [{
    id: work.id,
    codigo: work.codigo,
    nome: work.nome,
    status: work.status,
    data_inicio: work.data_inicio,
    data_fim_prevista: work.data_fim_prevista,
  }], hoje, company.id, { locale: company.locale, moeda: company.moeda });
  const metrics = indicators?.indicadores;

  const weekStart = inicioDaSemana(hoje);
  const { data: weekRdos } = await supabase
    .from("obx_rdos")
    .select("id,data,status")
    .eq("obra_id", work.id)
    .gte("data", weekStart)
    .order("data", { ascending: false });
  const weekRdoIds = (weekRdos ?? []).filter((rdo) => rdo.status === "confirmado").map((rdo) => rdo.id);
  const { data: weekProduction } = weekRdoIds.length
    ? await supabase.from("obx_rdo_producao").select("eap_item_id,quantidade").in("rdo_id", weekRdoIds)
    : { data: [] };

  const servicos = (metrics?.porServico ?? []).map((service) => ({
    codigo: service.codigo,
    descricao: service.descricao,
    quantidadeOrcada: service.quantidadeOrcada,
    quantidadeExecutada: service.quantidadeExecutada,
    executadoPct: Math.round(
      (service.quantidadeOrcada > 0 ? service.quantidadeExecutada / service.quantidadeOrcada : 0) * 100,
    ),
    ...(canViewCosts ? {
      orcadoR$: service.orcado,
      executadoR$: service.valorAgregado,
      custoRealR$: service.custoReal,
      desvioR$: service.custoReal - service.valorAgregado,
    } : {}),
  }));
  const producaoSemana = new Map<string, number>();
  for (const line of weekProduction ?? []) {
    producaoSemana.set(line.eap_item_id, (producaoSemana.get(line.eap_item_id) ?? 0) + Number(line.quantidade));
  }
  const producaoPorServico = (metrics?.porServico ?? [])
    .filter((service) => producaoSemana.get(service.id))
    .map((service) => ({
      codigo: service.codigo,
      descricao: service.descricao,
      quantidadeNaSemana: producaoSemana.get(service.id),
    }));

  const contexto = {
    hoje,
    obra: {
      codigo: work.codigo,
      nome: work.nome,
      status: work.status,
      dataInicio: work.data_inicio,
      dataFimPrevista: work.data_fim_prevista,
      ...(canViewCosts ? { valorContratoR$: work.valor_contrato } : {}),
    },
    indicadores: canViewCosts ? {
      avancoPct: metrics ? Math.round((metrics.valorAgregado / Math.max(metrics.orcado, 1)) * 100) : null,
      planejadoPct: metrics ? Math.round(metrics.planejadoPct * 100) : null,
      idcCustoXExecutado: metrics?.idc ?? null,
      idpPrazo: metrics?.idp ?? null,
      orcadoR$: metrics?.orcado ?? null,
      custoRealR$: metrics?.custoReal ?? null,
      valorAgregadoR$: metrics?.valorAgregado ?? null,
      custoFinalPrevistoR$: metrics?.custoFinalPrevisto ?? null,
    } : {
      avancoPct: metrics ? Math.round((metrics.valorAgregado / Math.max(metrics.orcado, 1)) * 100) : null,
      planejadoPct: metrics ? Math.round(metrics.planejadoPct * 100) : null,
      idpPrazo: metrics?.idp ?? null,
    },
    servicos,
    producaoConfirmadaNaSemana: producaoPorServico,
    alertas: (indicators?.alertas ?? [])
      .filter((alert) => Boolean(canViewCosts) || alert.id === "sem-rdo" || alert.id === "queda-producao"
        || alert.id.startsWith("rascunho-") || alert.id.startsWith("producao-") || alert.id.startsWith("atraso-"))
      .map((alert) => ({ severidade: alert.severidade, titulo: alert.titulo, detalhe: alert.detalhe })),
    rdosNaSemana: (weekRdos ?? []).map((rdo) => ({ data: rdo.data, status: rdo.status })),
  };

  const { chatCompletion } = await import("@/lib/ai/chat");
  const resposta = await chatCompletion(
    `Você é o assistente do Obratrix, plataforma de gestão de obras para construtoras. ` +
    `Responda em pt-BR, curto e direto (até ~6 linhas), usando SOMENTE o JSON de contexto. ` +
    `Se a informação pedida não estiver no contexto, diga que o dado não está registrado no Obratrix. ` +
    `Valores com "R$" estão em reais. Percentuais vão de 0 a 100. "PPC" é o percentual de itens do plano semanal cumpridos.`,
    [{ role: "user", content: `Contexto da obra (JSON):\n${JSON.stringify(contexto)}\n\nPergunta: ${parsed.data.pergunta}` }],
  );
  if (!resposta) return { error: "A IA ainda não está configurada (defina AI_API_KEY) ou não respondeu. Tente novamente." };
  return { resposta };
}

const vozSchema = z.object({
  obraId: z.string().uuid(),
  texto: z.string().trim().min(5, "Diga algo sobre o dia.").max(4000),
});

export type RdoVozDados = {
  clima_manha: string;
  clima_tarde: string;
  mao_obra: { funcao: string; quantidade: number; horas: number }[];
  producao: { eap_item_id: string; servico_busca: string; quantidade: number; observacao: string }[];
  producao_sem_match: string[];
  equipamentos: { equipamento: string; horas_trabalhadas: number; horas_paradas: number; motivo_parada: string }[];
  materiais: { material: string; quantidade: number; unidade: string }[];
  ocorrencias: { tipo: string; descricao: string; hora_inicio: string; hora_fim: string }[];
  observacoes: string;
};

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export async function parseRdoVozAction(input: unknown): Promise<{ error?: string; dados?: RdoVozDados }> {
  const parsed = vozSchema.safeParse(input);
  if (!parsed.success) return { error: "Não entendi o relato — tente falar novamente." };

  const { supabase } = await getCompanyContext();
  const { data: canRecord } = await supabase.rpc("obx_fn_pode_registrar_campo", {
    p_obra_id: parsed.data.obraId,
  });
  if (!canRecord) return { error: "Você não tem permissão para registrar RDO nesta obra." };

  const { data: services } = await supabase
    .from("obx_eap_itens")
    .select("id,codigo,descricao,unidade")
    .eq("obra_id", parsed.data.obraId)
    .eq("tipo", "servico");

  const catalogo = (services ?? []).map((service) => ({
    codigo: service.codigo,
    descricao: service.descricao,
    unidade: service.unidade,
  }));

  const { chatCompletion } = await import("@/lib/ai/chat");
  const resposta = await chatCompletion(
    `Você converte um relato falado de obra em JSON estruturado para o diário de obra (RDO) brasileiro. ` +
    `Responda SOMENTE com JSON válido, sem markdown, neste formato exato: ` +
    `{"clima_manha":"","clima_tarde":"","mao_obra":[{"funcao":"","quantidade":0,"horas":0}],` +
    `"producao":[{"servico":"","quantidade":0,"observacao":""}],` +
    `"equipamentos":[{"equipamento":"","horas_trabalhadas":0,"horas_paradas":0,"motivo_parada":""}],` +
    `"materiais":[{"material":"","quantidade":0,"unidade":""}],` +
    `"ocorrencias":[{"tipo":"","descricao":"","hora_inicio":"","hora_fim":""}],"observacoes":""}. ` +
    `Regras: clima em bom|nublado|chuva_fraca|chuva_forte|impraticavel (ou "" se não citado); ` +
    `em "servico", retorne o CÓDIGO da EAP quando identificar o serviço no catálogo; ` +
    `se não tiver certeza de qual serviço é, retorne a descrição como foi falada; ` +
    `quantidade em número; ` +
    `horas_trabalhadas/horas_paradas e mao_obra.horas em horas (número); hora_inicio/hora_fim em HH:MM ou ""; ` +
    `omita campos que o relato não mencionar. Não invente dados.`,
    [{ role: "user", content: `Serviços da EAP desta obra (JSON): ${JSON.stringify(catalogo)}\n\nRelato: ${parsed.data.texto}` }],
    4000,
  );
  if (!resposta) return { error: "A IA não respondeu. Verifique AI_API_KEY ou tente novamente." };

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(resposta.replace(/^```(?:json)?|```$/g, "").trim()) as Record<string, unknown>;
  } catch {
    return { error: "A IA retornou um formato inválido — tente novamente." };
  }
  const lista = (valor: unknown) => (Array.isArray(valor) ? valor : []);
  const numero = (valor: unknown) => {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
  const clima = (valor: unknown) => {
    const v = normalizar(texto(valor)).replace(/[^a-z_]/g, "");
    return ["bom", "nublado", "chuva_fraca", "chuva_forte", "impraticavel"].includes(v) ? v : "";
  };

  const porCodigo = new Map((services ?? []).map((s) => [normalizar(s.codigo), s]));
  const porDescricao = new Map((services ?? []).map((s) => [normalizar(s.descricao), s]));
  const resolverServico = (termo: string) => {
    const alvo = normalizar(termo);
    if (!alvo) return null;
    const direto = porCodigo.get(alvo) ?? porDescricao.get(alvo);
    if (direto) return direto;
    const porPrefixo = (services ?? []).find((s) => {
      const codigo = normalizar(s.codigo);
      const descricao = normalizar(s.descricao);
      return alvo.startsWith(codigo) || descricao.includes(alvo) || alvo.includes(descricao);
    });
    if (porPrefixo) return porPrefixo;
    // melhor sobreposição de palavras (ignora palavras curtas); exige 2+ palavras em comum
    const palavras = new Set(alvo.split(/\s+/).filter((p) => p.length > 3));
    if (!palavras.size) return null;
    let melhor: NonNullable<typeof services>[number] | null = null;
    let melhorScore = 0;
    for (const s of services ?? []) {
      const score = normalizar(`${s.codigo} ${s.descricao}`)
        .split(/\s+/)
        .filter((p) => palavras.has(p)).length;
      if (score > melhorScore) {
        melhorScore = score;
        melhor = s;
      }
    }
    return melhorScore >= 2 ? melhor : null;
  };

  const producao: RdoVozDados["producao"] = [];
  const producaoSemMatch: string[] = [];
  for (const linha of lista(raw.producao) as Record<string, unknown>[]) {
    const servico = resolverServico(texto(linha.servico));
    if (!servico) {
      if (texto(linha.servico)) producaoSemMatch.push(texto(linha.servico));
      continue;
    }
    producao.push({
      eap_item_id: servico.id,
      servico_busca: `${servico.codigo} — ${servico.descricao}`,
      quantidade: numero(linha.quantidade),
      observacao: texto(linha.observacao),
    });
  }

  return {
    dados: {
      clima_manha: clima(raw.clima_manha),
      clima_tarde: clima(raw.clima_tarde),
      mao_obra: (lista(raw.mao_obra) as Record<string, unknown>[])
        .map((l) => ({ funcao: texto(l.funcao), quantidade: Math.round(numero(l.quantidade)), horas: numero(l.horas) }))
        .filter((l) => l.funcao),
      producao,
      producao_sem_match: producaoSemMatch,
      equipamentos: (lista(raw.equipamentos) as Record<string, unknown>[])
        .map((l) => ({
          equipamento: texto(l.equipamento),
          horas_trabalhadas: numero(l.horas_trabalhadas),
          horas_paradas: numero(l.horas_paradas),
          motivo_parada: texto(l.motivo_parada),
        }))
        .filter((l) => l.equipamento),
      materiais: (lista(raw.materiais) as Record<string, unknown>[])
        .map((l) => ({ material: texto(l.material), quantidade: numero(l.quantidade), unidade: texto(l.unidade) }))
        .filter((l) => l.material),
      ocorrencias: (lista(raw.ocorrencias) as Record<string, unknown>[])
        .map((l) => ({
          tipo: texto(l.tipo),
          descricao: texto(l.descricao),
          hora_inicio: texto(l.hora_inicio),
          hora_fim: texto(l.hora_fim),
        }))
        .filter((l) => l.tipo || l.descricao),
      observacoes: texto(raw.observacoes),
    },
  };
}

const medicaoSchema = z.object({
  obraId: z.string().uuid(),
  periodoInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o início do período."),
  periodoFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o fim do período."),
});

export async function emitirMedicaoAction(input: unknown): Promise<ActionState & { medicaoId?: string }> {
  const parsed = medicaoSchema.safeParse(input);
  if (!parsed.success) return { error: "Informe um período válido." };
  if (parsed.data.periodoFim < parsed.data.periodoInicio) {
    return { error: "O fim do período não pode ser antes do início." };
  }

  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", parsed.data.obraId)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return { error: "Obra não encontrada na empresa ativa." };

  const { data: medicaoId, error } = await supabase.rpc("obx_fn_emitir_medicao", {
    p_obra_id: work.id,
    p_periodo_inicio: parsed.data.periodoInicio,
    p_periodo_fim: parsed.data.periodoFim,
  });
  if (error || !medicaoId) {
    return { error: error?.message ?? "Não foi possível emitir a medição." };
  }

  revalidatePath(`/app/obras/${parsed.data.obraId}/medicao`);
  return { success: "Medição emitida.", medicaoId };
}
