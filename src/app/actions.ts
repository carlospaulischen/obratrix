"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCompanyContext } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };

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
