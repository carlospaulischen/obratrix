import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { getCompanyContext } from "@/lib/company";
import { parsePlanilhaCustos, type LinhaCustoExcel } from "@/lib/custos/parse-planilha";

export const runtime = "nodejs";

const maxBytes = 5 * 1024 * 1024;
const maxRows = 5000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("arquivo");
  const intent = form.get("intent");
  if (!(file instanceof File) || !file.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) {
    return Response.json({ error: "Selecione um arquivo .xlsx." }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return Response.json({ error: "O arquivo ultrapassa o limite de 5 MB." }, { status: 413 });
  }
  if (intent !== "preview" && intent !== "confirm") {
    return Response.json({ error: "Ação de importação inválida." }, { status: 400 });
  }

  const { supabase, company } = await getCompanyContext();
  const [{ data: work }, { data: canEdit }] = await Promise.all([
    supabase.from("obx_obras").select("id").eq("id", id).eq("empresa_id", company.id).maybeSingle(),
    supabase.rpc("obx_fn_pode_editar_custo", { p_obra_id: id }),
  ]);
  if (!work) return Response.json({ error: "Obra não encontrada." }, { status: 404 });
  if (!canEdit) return Response.json({ error: "Você não tem permissão para importar custos nesta obra." }, { status: 403 });

  let rows: LinhaCustoExcel[];
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(await file.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    const sheet = workbook.worksheets[0];
    if (!sheet) return Response.json({ error: "O arquivo não contém uma planilha." }, { status: 400 });
    if (sheet.rowCount > maxRows + 1) {
      return Response.json({ error: "A planilha ultrapassa o limite de 5.000 linhas." }, { status: 413 });
    }
    rows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) as unknown[] : [];
      if (values.some((value) => value !== null && value !== undefined && String(value).trim())) {
        rows.push({ linha: row.number, valores: values });
      }
    });
  } catch {
    return Response.json({ error: "Não foi possível ler o arquivo Excel." }, { status: 400 });
  }

  const [{ data: services, error: servicesError }, { data: centers, error: centersError }] =
    await Promise.all([
      supabase.from("obx_eap_itens").select("codigo").eq("obra_id", id).eq("tipo", "servico"),
      supabase.from("obx_centros_custo").select("codigo").eq("empresa_id", company.id),
    ]);
  if (servicesError || centersError) {
    return Response.json({ error: "Não foi possível validar os serviços e centros de custo." }, { status: 500 });
  }

  const result = parsePlanilhaCustos(rows, {
    servicosEap: new Set((services ?? []).map((entry) => entry.codigo)),
    centrosCusto: new Set((centers ?? []).map((entry) => entry.codigo)),
  });
  const total = result.itens.reduce((sum, item) => sum + item.valor, 0);
  if (intent === "preview") {
    return Response.json({ lancamentos: result.itens.length, total, erros: result.erros });
  }
  if (result.erros.length || !result.itens.length) {
    return Response.json({
      error: result.erros.length ? "Corrija os erros antes de confirmar." : "A planilha não contém lançamentos.",
      lancamentos: result.itens.length,
      total,
      erros: result.erros,
    }, { status: 422 });
  }

  const { data: counts, error } = await supabase.rpc("obx_fn_importar_custos", {
    p_obra_id: id,
    p_itens: result.itens,
  });
  if (error) {
    const message = error.message.includes("data futura")
      || error.message.includes("Serviço EAP")
      || error.message.includes("Centro de custo")
      ? error.message
      : "Não foi possível aplicar a importação. Revise a planilha e tente novamente.";
    return Response.json({ error: message }, { status: 400 });
  }
  revalidatePath(`/app/obras/${id}/custos`);
  return Response.json({ counts });
}
