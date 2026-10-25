import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { getCompanyContext } from "@/lib/company";
import { parsePlanilha, type LinhaExcel } from "@/lib/orcamento/parse-planilha";

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
  const mode = form.get("modo");
  if (!(file instanceof File) || !file.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) {
    return Response.json({ error: "Selecione um arquivo .xlsx." }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return Response.json({ error: "O arquivo ultrapassa o limite de 5 MB." }, { status: 413 });
  }
  if (mode !== "substituir" && mode !== "mesclar") {
    return Response.json({ error: "Selecione um modo de importação válido." }, { status: 400 });
  }
  if (intent !== "preview" && intent !== "confirm") {
    return Response.json({ error: "Ação de importação inválida." }, { status: 400 });
  }

  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase.from("obx_obras").select("id")
    .eq("id", id).eq("empresa_id", company.id).maybeSingle();
  if (!work) return Response.json({ error: "Obra não encontrada." }, { status: 404 });
  const { data: canEdit } = await supabase.rpc("obx_fn_pode_editar_obra", { p_obra_id: id });
  if (!canEdit) return Response.json({ error: "Sem permissão para editar esta EAP." }, { status: 403 });

  let rows: LinhaExcel[];
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

  const [{ data: centerRows }, { data: existingRows }] = await Promise.all([
    supabase.from("obx_centros_custo").select("id,codigo").eq("empresa_id", company.id),
    mode === "mesclar"
      ? supabase.from("obx_eap_itens").select("codigo").eq("obra_id", id)
      : Promise.resolve({ data: [] }),
  ]);
  const result = parsePlanilha(rows, {
    modo: mode,
    codigosExistentes: new Set((existingRows ?? []).map((item) => item.codigo)),
    centrosCusto: new Map((centerRows ?? []).map((center) => [center.codigo, center.id])),
  });
  const etapas = result.itens.filter((item) => item.tipo === "etapa").length;
  const servicos = result.itens.filter((item) => item.tipo === "servico").length;
  const total = result.itens.filter((item) => item.tipo === "servico")
    .reduce((sum, item) => sum + item.quantidade * item.custo_unitario, 0);
  if (intent === "preview") return Response.json({ etapas, servicos, total, erros: result.erros });
  if (result.erros.length || !result.itens.length) {
    return Response.json({
      error: result.erros.length ? "Corrija os erros antes de confirmar." : "A planilha não contém itens.",
      erros: result.erros,
      etapas,
      servicos,
      total,
    }, { status: 422 });
  }

  const { data: counts, error } = await supabase.rpc("obx_fn_importar_eap", {
    p_obra_id: id,
    p_itens: result.itens,
    p_modo: mode,
  });
  if (error) {
    const message = error.message.includes("Não é possível substituir")
      ? error.message
      : "Não foi possível aplicar a importação. Revise a planilha e tente novamente.";
    return Response.json({ error: message }, { status: 400 });
  }
  revalidatePath(`/app/obras/${id}/orcamento`);
  return Response.json({ counts });
}
