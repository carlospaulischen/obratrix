"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCompanyContext } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { dataHoje, dataIsoValida } from "@/lib/rdo/data";
import { rdoPayloadSchema } from "@/lib/rdo/schema";

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
