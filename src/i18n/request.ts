import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  let locale = cookieStore.get("obx_locale")?.value;
  if (!locale) {
    const companyId = cookieStore.get("obx_empresa_id")?.value;
    if (companyId) {
      const supabase = await createClient();
      const { data: company } = await supabase
        .from("obx_empresas")
        .select("locale")
        .eq("id", companyId)
        .maybeSingle();
      locale = company?.locale ?? undefined;
    }
  }
  locale = locale === "pt-BR" ? locale : "pt-BR";
  const messages = (await import("../../messages/pt-BR.json")).default;
  return { locale, messages };
});
