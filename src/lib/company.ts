import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships, error: membershipsError } = await supabase
    .from("obx_empresa_membros")
    .select("empresa_id,perfil")
    .eq("usuario_id", user.id);
  if (membershipsError) throw new Error("Não foi possível carregar as empresas do usuário.");
  if (!memberships?.length) redirect("/onboarding");

  const { data: companies, error: companiesError } = await supabase
    .from("obx_empresas")
    .select("id,nome,locale,moeda")
    .in("id", memberships.map((membership) => membership.empresa_id));
  if (companiesError || !companies?.length) {
    throw new Error("Não foi possível carregar os dados da empresa.");
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get("obx_empresa_id")?.value;
  const company = companies.find((entry) => entry.id === activeId) ?? companies[0]!;
  const membership = memberships.find((entry) => entry.empresa_id === company.id)!;

  return { supabase, user, companies, company, perfil: membership.perfil };
}
