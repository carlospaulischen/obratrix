import ExcelJS from "exceljs";
import { getCompanyContext } from "@/lib/company";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, company } = await getCompanyContext();
  const { data: work } = await supabase
    .from("obx_obras")
    .select("id")
    .eq("id", id)
    .eq("empresa_id", company.id)
    .maybeSingle();
  if (!work) return new Response("Obra não encontrada.", { status: 404 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Obratrix";
  const sheet = workbook.addWorksheet("Orçamento EAP");
  sheet.addRow(["Código", "Descrição", "Unidade", "Quantidade", "Custo unitário", "Centro de custo", "Início previsto", "Fim previsto"]);
  sheet.addRows([
    ["1", "Serviços preliminares", "", "", "", "", "", ""],
    ["1.1", "Locação da obra", "m²", 380, 18, "FND", "22/07/2026", "17/08/2026"],
    ["1.2", "Escavação de valas", "m³", 145, 28, "FND", "26/07/2026", "21/08/2026"],
  ]);
  sheet.getRow(1).font = { bold: true };
  return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-orcamento-eap.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
