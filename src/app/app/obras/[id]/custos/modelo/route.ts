import ExcelJS from "exceljs";
import { getCompanyContext } from "@/lib/company";
import { dataHoje } from "@/lib/rdo/data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, company } = await getCompanyContext();
  const [{ data: work }, { data: canView }, { data: service }, { data: center }] = await Promise.all([
    supabase.from("obx_obras").select("id").eq("id", id).eq("empresa_id", company.id).maybeSingle(),
    supabase.rpc("obx_fn_pode_ver_custo", { p_obra_id: id }),
    supabase.from("obx_eap_itens").select("codigo,centro_custo_id").eq("obra_id", id).eq("tipo", "servico").order("codigo").limit(1).maybeSingle(),
    supabase.from("obx_centros_custo").select("codigo").eq("empresa_id", company.id).order("codigo").limit(1).maybeSingle(),
  ]);
  if (!work || !canView) return new Response("Não encontrado.", { status: 404 });
  const serviceCenter = service?.centro_custo_id
    ? await supabase.from("obx_centros_custo").select("codigo").eq("id", service.centro_custo_id).maybeSingle()
    : { data: null };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Obratrix";
  const sheet = workbook.addWorksheet("Custos");
  sheet.addRow(["Data", "Descrição", "Categoria", "Valor", "Fornecedor", "Documento", "Código EAP", "Centro de custo"]);
  const today = dataHoje(company.fuso_horario);
  const centerCode = serviceCenter.data?.codigo ?? center?.codigo ?? "";
  sheet.addRows([
    [today, "Compra de materiais", "Material", 1234.56, "Fornecedor exemplo", "NF-0001", service?.codigo ?? "", centerCode],
    [today, "Equipe de execução", "Mão de obra", 850, "Equipe própria", "NF-0002", service?.codigo ?? "", centerCode],
    [today, "Despesas de canteiro", "Indireto", 320, "Serviços gerais", "NF-0003", "", ""],
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  sheet.getColumn(4).numFmt = '"R$" #,##0.00';

  return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-custos.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
