import { AppShell } from "@/components/app-shell";
import { getCompanyContext } from "@/lib/company";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getCompanyContext();
  const { data: profile } = await context.supabase
    .from("obx_usuarios")
    .select("nome")
    .eq("id", context.user.id)
    .maybeSingle();
  const companyList = context.companies.map(({ id, nome, locale }) => ({ id, nome, locale }));

  return (
    <AppShell
      company={context.company}
      companies={companyList}
      email={context.user.email ?? ""}
      name={profile?.nome ?? ""}
      perfil={context.perfil}
    >
      {children}
    </AppShell>
  );
}
