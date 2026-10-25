import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { avaliarAlertas } from "../src/lib/indicadores/alertas";
import { calcularIndicadores } from "../src/lib/indicadores/calcular";
import { dataHoje } from "../src/lib/rdo/data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;

if (!url || !serviceRoleKey || !password) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SEED_PASSWORD.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Profile = "diretor" | "engenheiro" | "encarregado" | "financeiro";
type ServiceSpec = {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
  centro: string;
};
type StageSpec = { codigo: string; descricao: string; servicos: ServiceSpec[] };

const people: { email: string; nome: string; perfil: Profile }[] = [
  { email: "diretor@obratrix.demo", nome: "Mariana Costa", perfil: "diretor" },
  { email: "engenheiro@obratrix.demo", nome: "Rafael Mendes", perfil: "engenheiro" },
  { email: "encarregado@obratrix.demo", nome: "João Ferreira", perfil: "encarregado" },
  { email: "financeiro@obratrix.demo", nome: "Beatriz Almeida", perfil: "financeiro" },
];

const centers = [
  { codigo: "ADM", nome: "Administração da obra" },
  { codigo: "FND", nome: "Fundações" },
  { codigo: "EST", nome: "Estrutura" },
  { codigo: "VED", nome: "Vedações e alvenaria" },
  { codigo: "INS", nome: "Instalações" },
  { codigo: "ACA", nome: "Acabamentos" },
  { codigo: "EXT", nome: "Serviços externos" },
];

const residenceStages: StageSpec[] = [
  {
    codigo: "1",
    descricao: "Serviços preliminares e fundações",
    servicos: [
      { codigo: "1.1", descricao: "Locação e gabarito da obra", unidade: "m²", quantidade: 380, custoUnitario: 18, centro: "FND" },
      { codigo: "1.2", descricao: "Escavação mecanizada de valas", unidade: "m³", quantidade: 145, custoUnitario: 28, centro: "FND" },
      { codigo: "1.3", descricao: "Lastro de concreto magro", unidade: "m³", quantidade: 8, custoUnitario: 510, centro: "FND" },
      { codigo: "1.4", descricao: "Armadura de sapatas e blocos", unidade: "kg", quantidade: 3100, custoUnitario: 12.8, centro: "FND" },
      { codigo: "1.5", descricao: "Concreto estrutural em fundações", unidade: "m³", quantidade: 46, custoUnitario: 790, centro: "FND" },
      { codigo: "1.6", descricao: "Impermeabilização de baldrames", unidade: "m²", quantidade: 96, custoUnitario: 82, centro: "FND" },
    ],
  },
  {
    codigo: "2",
    descricao: "Estrutura de concreto armado",
    servicos: [
      { codigo: "2.1", descricao: "Formas para vigas e pilares", unidade: "m²", quantidade: 610, custoUnitario: 112, centro: "EST" },
      { codigo: "2.2", descricao: "Armadura de aço CA-50", unidade: "kg", quantidade: 8900, custoUnitario: 13.2, centro: "EST" },
      { codigo: "2.3", descricao: "Concreto bombeado em pilares e vigas", unidade: "m³", quantidade: 92, custoUnitario: 845, centro: "EST" },
      { codigo: "2.4", descricao: "Lajes maciças e nervuradas", unidade: "m²", quantidade: 380, custoUnitario: 298, centro: "EST" },
      { codigo: "2.5", descricao: "Escada de concreto moldada in loco", unidade: "un", quantidade: 2, custoUnitario: 14800, centro: "EST" },
    ],
  },
  {
    codigo: "3",
    descricao: "Vedações e alvenaria",
    servicos: [
      { codigo: "3.1", descricao: "Alvenaria de vedação em bloco cerâmico", unidade: "m²", quantidade: 690, custoUnitario: 126, centro: "VED" },
      { codigo: "3.2", descricao: "Vergas e contravergas de concreto", unidade: "m", quantidade: 175, custoUnitario: 54, centro: "VED" },
      { codigo: "3.3", descricao: "Divisórias internas em drywall", unidade: "m²", quantidade: 85, custoUnitario: 168, centro: "VED" },
      { codigo: "3.4", descricao: "Chapisco em paredes internas", unidade: "m²", quantidade: 1250, custoUnitario: 14.5, centro: "VED" },
      { codigo: "3.5", descricao: "Emboço e reboco interno", unidade: "m²", quantidade: 1180, custoUnitario: 42, centro: "VED" },
    ],
  },
  {
    codigo: "4",
    descricao: "Instalações prediais",
    servicos: [
      { codigo: "4.1", descricao: "Instalações elétricas e quadros", unidade: "m²", quantidade: 380, custoUnitario: 195, centro: "INS" },
      { codigo: "4.2", descricao: "Infraestrutura de dados e automação", unidade: "ponto", quantidade: 44, custoUnitario: 235, centro: "INS" },
      { codigo: "4.3", descricao: "Instalações hidrossanitárias", unidade: "m²", quantidade: 380, custoUnitario: 248, centro: "INS" },
      { codigo: "4.4", descricao: "Rede de gás e aquecimento solar", unidade: "vb", quantidade: 1, custoUnitario: 18400, centro: "INS" },
      { codigo: "4.5", descricao: "Infraestrutura de ar-condicionado", unidade: "ponto", quantidade: 8, custoUnitario: 1580, centro: "INS" },
    ],
  },
  {
    codigo: "5",
    descricao: "Revestimentos e pisos",
    servicos: [
      { codigo: "5.1", descricao: "Contrapiso e regularização", unidade: "m²", quantidade: 380, custoUnitario: 68, centro: "ACA" },
      { codigo: "5.2", descricao: "Piso em porcelanato de alto padrão", unidade: "m²", quantidade: 345, custoUnitario: 285, centro: "ACA" },
      { codigo: "5.3", descricao: "Revestimento cerâmico em áreas molhadas", unidade: "m²", quantidade: 220, custoUnitario: 215, centro: "ACA" },
      { codigo: "5.4", descricao: "Forro de gesso acartonado", unidade: "m²", quantidade: 360, custoUnitario: 138, centro: "ACA" },
      { codigo: "5.5", descricao: "Bancadas em granito e quartzo", unidade: "m", quantidade: 38, custoUnitario: 970, centro: "ACA" },
    ],
  },
  {
    codigo: "6",
    descricao: "Esquadrias e marcenaria",
    servicos: [
      { codigo: "6.1", descricao: "Esquadrias de alumínio e vidro", unidade: "m²", quantidade: 78, custoUnitario: 1480, centro: "ACA" },
      { codigo: "6.2", descricao: "Portas internas e ferragens", unidade: "un", quantidade: 18, custoUnitario: 2850, centro: "ACA" },
      { codigo: "6.3", descricao: "Marcenaria planejada", unidade: "vb", quantidade: 1, custoUnitario: 84500, centro: "ACA" },
    ],
  },
  {
    codigo: "7",
    descricao: "Pintura, louças e área externa",
    servicos: [
      { codigo: "7.1", descricao: "Pintura acrílica interna", unidade: "m²", quantidade: 1310, custoUnitario: 32, centro: "ACA" },
      { codigo: "7.2", descricao: "Pintura e textura externa", unidade: "m²", quantidade: 480, custoUnitario: 48, centro: "ACA" },
      { codigo: "7.3", descricao: "Louças, metais e acessórios", unidade: "conj", quantidade: 5, custoUnitario: 9200, centro: "ACA" },
      { codigo: "7.4", descricao: "Calçadas, paisagismo e drenagem", unidade: "m²", quantidade: 270, custoUnitario: 178, centro: "EXT" },
    ],
  },
];

const buildingStages: StageSpec[] = [
  {
    codigo: "1",
    descricao: "Implantação e fundações",
    servicos: [
      { codigo: "1.1", descricao: "Canteiro, tapumes e instalações provisórias", unidade: "vb", quantidade: 1, custoUnitario: 48000, centro: "ADM" },
      { codigo: "1.2", descricao: "Escavação e contenção do subsolo", unidade: "m³", quantidade: 2100, custoUnitario: 42, centro: "FND" },
      { codigo: "1.3", descricao: "Estacas hélice contínua", unidade: "m", quantidade: 980, custoUnitario: 245, centro: "FND" },
      { codigo: "1.4", descricao: "Blocos e vigas de fundação", unidade: "m³", quantidade: 285, custoUnitario: 920, centro: "FND" },
      { codigo: "1.5", descricao: "Impermeabilização de cortinas", unidade: "m²", quantidade: 840, custoUnitario: 104, centro: "FND" },
    ],
  },
  {
    codigo: "2",
    descricao: "Estrutura e vedações",
    servicos: [
      { codigo: "2.1", descricao: "Formas de pilares, vigas e lajes", unidade: "m²", quantidade: 7100, custoUnitario: 128, centro: "EST" },
      { codigo: "2.2", descricao: "Armadura CA-50 e CA-60", unidade: "kg", quantidade: 74000, custoUnitario: 13.9, centro: "EST" },
      { codigo: "2.3", descricao: "Concreto usinado bombeado", unidade: "m³", quantidade: 940, custoUnitario: 890, centro: "EST" },
      { codigo: "2.4", descricao: "Lajes e escadas pré-moldadas", unidade: "m²", quantidade: 2850, custoUnitario: 375, centro: "EST" },
      { codigo: "2.5", descricao: "Alvenaria de vedação em bloco cerâmico", unidade: "m²", quantidade: 5200, custoUnitario: 139, centro: "VED" },
      { codigo: "2.6", descricao: "Alvenaria estrutural em blocos de concreto", unidade: "m²", quantidade: 1450, custoUnitario: 184, centro: "VED" },
      { codigo: "2.7", descricao: "Vergas, contravergas e cintas", unidade: "m", quantidade: 1230, custoUnitario: 63, centro: "VED" },
    ],
  },
  {
    codigo: "3",
    descricao: "Instalações",
    servicos: [
      { codigo: "3.1", descricao: "Infraestrutura elétrica e medição", unidade: "m²", quantidade: 2850, custoUnitario: 245, centro: "INS" },
      { codigo: "3.2", descricao: "Cabeamento, iluminação e áreas comuns", unidade: "ponto", quantidade: 880, custoUnitario: 188, centro: "INS" },
      { codigo: "3.3", descricao: "Instalações hidráulicas e barrilete", unidade: "m²", quantidade: 2850, custoUnitario: 238, centro: "INS" },
      { codigo: "3.4", descricao: "Rede de esgoto, águas pluviais e reuso", unidade: "m²", quantidade: 2850, custoUnitario: 176, centro: "INS" },
      { codigo: "3.5", descricao: "Elevadores e casa de máquinas", unidade: "un", quantidade: 2, custoUnitario: 248000, centro: "INS" },
      { codigo: "3.6", descricao: "Combate a incêndio e pressurização", unidade: "vb", quantidade: 1, custoUnitario: 172000, centro: "INS" },
    ],
  },
  {
    codigo: "4",
    descricao: "Revestimentos e esquadrias",
    servicos: [
      { codigo: "4.1", descricao: "Chapisco e emboço interno", unidade: "m²", quantidade: 11800, custoUnitario: 54, centro: "ACA" },
      { codigo: "4.2", descricao: "Revestimento cerâmico de cozinhas e banhos", unidade: "m²", quantidade: 2950, custoUnitario: 242, centro: "ACA" },
      { codigo: "4.3", descricao: "Contrapiso e piso porcelanato", unidade: "m²", quantidade: 2850, custoUnitario: 196, centro: "ACA" },
      { codigo: "4.4", descricao: "Forros de gesso e sancas", unidade: "m²", quantidade: 2650, custoUnitario: 146, centro: "ACA" },
      { codigo: "4.5", descricao: "Esquadrias de alumínio e guarda-corpos", unidade: "m²", quantidade: 980, custoUnitario: 1650, centro: "ACA" },
      { codigo: "4.6", descricao: "Portas, batentes e ferragens", unidade: "un", quantidade: 146, custoUnitario: 1780, centro: "ACA" },
    ],
  },
  {
    codigo: "5",
    descricao: "Acabamentos e serviços externos",
    servicos: [
      { codigo: "5.1", descricao: "Pintura interna e áreas comuns", unidade: "m²", quantidade: 11500, custoUnitario: 35, centro: "ACA" },
      { codigo: "5.2", descricao: "Revestimento de fachada e pintura externa", unidade: "m²", quantidade: 2450, custoUnitario: 228, centro: "ACA" },
      { codigo: "5.3", descricao: "Louças, metais e bancadas", unidade: "un", quantidade: 72, custoUnitario: 4980, centro: "ACA" },
      { codigo: "5.4", descricao: "Pavimentação e urbanização do lote", unidade: "m²", quantidade: 840, custoUnitario: 220, centro: "EXT" },
      { codigo: "5.5", descricao: "Paisagismo, iluminação e drenagem", unidade: "vb", quantidade: 1, custoUnitario: 156000, centro: "EXT" },
      { codigo: "5.6", descricao: "Limpeza final e entrega das unidades", unidade: "m²", quantidade: 2850, custoUnitario: 16, centro: "EXT" },
    ],
  },
];

function uuidFor(key: string) {
  const bytes = createHash("sha256").update(key).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireSuccess(error: { message?: string } | null) {
  if (error) throw new Error(error.message ?? "Falha ao gravar dados de demonstração.");
}

function daysAgo(days: number, fusoHorario = "America/Sao_Paulo") {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: fusoHorario }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function getUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const users = new Map<string, string>();
  for (const person of people) {
    const existing = data.users.find((user) => user.email === person.email);
    if (existing) {
      const updated = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { nome: person.nome },
      });
      if (updated.error) throw updated.error;
      users.set(person.email, existing.id);
    } else {
      const created = await supabase.auth.admin.createUser({
        email: person.email,
        password,
        email_confirm: true,
        user_metadata: { nome: person.nome },
      });
      if (created.error || !created.data.user) {
        throw created.error ?? new Error(`Não foi possível criar ${person.email}.`);
      }
      users.set(person.email, created.data.user.id);
    }
  }
  return users;
}

async function seedCompany() {
  const lookup = await supabase
    .from("obx_empresas")
    .select("id")
    .eq("nome", "Construtora Exemplo Ltda")
    .maybeSingle();
  requireSuccess(lookup.error);

  if (lookup.data) return lookup.data.id as string;

  const created = await supabase
    .from("obx_empresas")
    .insert({
      id: uuidFor("obratrix:empresa-exemplo"),
      nome: "Construtora Exemplo Ltda",
      cnpj: "12.345.678/0001-90",
      locale: "pt-BR",
      moeda: "BRL",
      fuso_horario: "America/Sao_Paulo",
    })
    .select("id")
    .single();
  requireSuccess(created.error);
  return created.data!.id as string;
}

async function upsertEap(obraId: string, stages: StageSpec[], centerIds: Map<string, string>) {
  const stageRows = stages.map((stage) => ({
    obra_id: obraId,
    parent_id: null,
    codigo: stage.codigo,
    descricao: stage.descricao,
    tipo: "etapa",
    unidade: null,
    quantidade: 0,
    custo_unitario: 0,
    centro_custo_id: null,
    ordem: Number(stage.codigo),
  }));
  const stageResult = await supabase
    .from("obx_eap_itens")
    .upsert(stageRows, { onConflict: "obra_id,codigo" });
  requireSuccess(stageResult.error);

  const existingStages = await supabase
    .from("obx_eap_itens")
    .select("id,codigo")
    .eq("obra_id", obraId)
    .eq("tipo", "etapa");
  requireSuccess(existingStages.error);
  const stageIds = new Map((existingStages.data ?? []).map((row) => [row.codigo, row.id]));
  const serviceRows = stages.flatMap((stage) => stage.servicos.map((service) => ({
    obra_id: obraId,
    parent_id: stageIds.get(stage.codigo) ?? null,
    codigo: service.codigo,
    descricao: service.descricao,
    tipo: "servico",
    unidade: service.unidade,
    quantidade: service.quantidade,
    custo_unitario: service.custoUnitario,
    centro_custo_id: centerIds.get(service.centro) ?? null,
    ordem: Number(service.codigo.replace(".", "")),
  })));
  const servicesResult = await supabase
    .from("obx_eap_itens")
    .upsert(serviceRows, { onConflict: "obra_id,codigo" });
  requireSuccess(servicesResult.error);

  const services = await supabase
    .from("obx_eap_itens")
    .select("id,codigo,descricao,quantidade,custo_unitario,centro_custo_id")
    .eq("obra_id", obraId)
    .eq("tipo", "servico")
    .order("ordem");
  requireSuccess(services.error);
  return services.data ?? [];
}

async function seedRdos(
  obraId: string,
  services: { id: string; codigo: string; descricao: string; quantidade: number; custo_unitario: number; centro_custo_id: string | null }[],
  userIds: Map<string, string>,
  centerIds: Map<string, string>,
  workIndex: number,
  fusoHorario: string,
) {
  const foremanId = userIds.get("encarregado@obratrix.demo")!;
  const directorId = userIds.get("diretor@obratrix.demo")!;
  const dates = Array.from({ length: 30 }, (_, index) => daysAgo(30 - index, fusoHorario));
  const rdoRows = dates.map((data, index) => ({
    id: uuidFor(`obratrix:rdo:${obraId}:${data}`),
    obra_id: obraId,
    data,
    clima_manha: index % 9 === 0 ? "nublado" : "bom",
    clima_tarde: index % 13 === 0 ? "chuva_fraca" : "bom",
    observacoes: index % 7 === 0 ? "Conferência de materiais e alinhamento da equipe." : "Atividades conforme programação da frente.",
    status: index >= dates.length - 2 || (workIndex === 1 && index === 0) ? "rascunho" : "confirmado",
    criado_por: foremanId,
    confirmado_por: index >= dates.length - 2 || (workIndex === 1 && index === 0) ? null : directorId,
    confirmado_em: index >= dates.length - 2 || (workIndex === 1 && index === 0) ? null : `${data}T17:30:00-03:00`,
  }));
  const rdoResult = await supabase
    .from("obx_rdos")
    .upsert(rdoRows, { onConflict: "obra_id,data" })
    .select("id,data");
  requireSuccess(rdoResult.error);
  const rdoIds = new Map((rdoResult.data ?? []).map((rdo) => [rdo.data, rdo.id]));

  const manpowerRows = dates.map((data, index) => ({
    id: uuidFor(`obratrix:mao-obra:${obraId}:${data}`),
    rdo_id: rdoIds.get(data),
    funcao: index % 3 === 0 ? "Pedreiro" : "Servente",
    quantidade: index % 3 === 0 ? 4 : 5,
    horas: 8,
  }));
  const manpowerResult = await supabase.from("obx_rdo_mao_obra").upsert(manpowerRows);
  requireSuccess(manpowerResult.error);

  const targetProgress = workIndex === 0 ? 0.4 : 0.28;
  const productionRows = dates.flatMap((data) => services.map((service) => ({
    id: uuidFor(`obratrix:producao:${obraId}:${data}:${service.id}`),
    rdo_id: rdoIds.get(data),
    eap_item_id: service.id,
    quantidade: Number((service.quantidade * targetProgress / dates.length).toFixed(4)),
    observacao: "Produção registrada pela equipe de campo.",
  })));
  const cleanupProduction = await supabase.from("obx_rdo_producao").delete()
    .in("rdo_id", [...rdoIds.values()]);
  requireSuccess(cleanupProduction.error);
  const productionResult = await supabase.from("obx_rdo_producao").upsert(productionRows);
  requireSuccess(productionResult.error);

  const occurrenceRows = dates
    .filter((_, index) => index % 6 === 0)
    .map((data, index) => ({
      id: uuidFor(`obratrix:ocorrencia:${obraId}:${data}`),
      rdo_id: rdoIds.get(data),
      tipo: index % 2 === 0 ? "suprimento" : "seguranca",
      descricao: index % 2 === 0
        ? "Atraso na entrega de insumos; equipe reorganizada em outra frente."
        : "DDS realizado e inspeção de EPIs concluída.",
      hora_inicio: "08:00",
      hora_fim: "08:30",
    }));
  const occurrenceResult = await supabase.from("obx_rdo_ocorrencias").upsert(occurrenceRows);
  requireSuccess(occurrenceResult.error);

  const materialRows = dates
    .filter((_, index) => index % 5 === 0)
    .map((data, index) => ({
      id: uuidFor(`obratrix:material:${obraId}:${data}`),
      rdo_id: rdoIds.get(data),
      material: index % 2 === 0 ? "Cimento CP-II" : "Bloco cerâmico",
      quantidade: index % 2 === 0 ? 48 : 320,
      unidade: index % 2 === 0 ? "saco" : "un",
    }));
  const materialResult = await supabase.from("obx_rdo_materiais").upsert(materialRows);
  requireSuccess(materialResult.error);

  const equipmentRows = dates
    .filter((_, index) => index % 4 === 0)
    .map((data, index) => ({
      id: uuidFor(`obratrix:equipamento:${obraId}:${data}`),
      rdo_id: rdoIds.get(data),
      equipamento: index % 2 === 0 ? "Betoneira 400 L" : "Escavadeira hidráulica",
      horas_trabalhadas: index % 2 === 0 ? 6 : 5,
      horas_paradas: index % 2 === 0 ? 0.5 : 1,
      motivo_parada: index % 2 === 0 ? "Ajuste de posicionamento" : "Aguardando liberação de frente",
    }));
  const equipmentResult = await supabase.from("obx_rdo_equipamentos").upsert(equipmentRows);
  requireSuccess(equipmentResult.error);

  const budget = services.reduce((total, service) => total + service.quantidade * service.custo_unitario, 0);
  const expenseRatio = workIndex === 0 ? 0.43 : 0.28;
  const expenseCount = 30;
  const largestService = services.reduce((largest, item) =>
    item.quantidade * item.custo_unitario > largest.quantidade * largest.custo_unitario ? item : largest,
  );
  const budgetTotal = budget * expenseRatio;
  const overrunAmount = workIndex === 0
    ? largestService.quantidade * largestService.custo_unitario * 1.2
    : 0;
  const expenseRows = Array.from({ length: expenseCount }, (_, index) => {
    const amount = index === 0
      ? Math.max(overrunAmount, budgetTotal / expenseCount)
      : (budgetTotal - Math.max(overrunAmount, budgetTotal / expenseCount)) / (expenseCount - 1);
    const category = (["material", "mao_obra", "servico_terceiro", "equipamento", "indireto"] as const)[index % 5]!;
    const service = index === 0
      ? largestService
      : category === "indireto" ? null : services[(index - 1) % services.length]!;
    return {
      id: uuidFor(`obratrix:custo:${obraId}:${index}`),
      obra_id: obraId,
      eap_item_id: service?.id ?? null,
      categoria: category,
      descricao: [
        "Compra de aço e material básico",
        "Equipe de execução e apoio",
        "Serviço especializado de concretagem",
        "Locação de equipamento de obra",
        "Despesas de canteiro e segurança",
      ][index % 5],
      fornecedor: ["Aço Brasil", "Materiais Central", "Concretos Vale", "LocaObra", "Serviços Integrados"][index % 5],
      documento: `NF-${workIndex + 1}-${String(index + 1).padStart(4, "0")}`,
      data: dates[index % dates.length],
      valor: Number(amount.toFixed(2)),
      criado_por: userIds.get("financeiro@obratrix.demo")!,
      centro_custo_id: service ? null : centerIds.get("ADM") ?? null,
    };
  });
  const costResult = await supabase.from("obx_custos").upsert(expenseRows);
  requireSuccess(costResult.error);

  return { budget, productionCount: productionRows.length };
}

async function main() {
  const users = await getUsers();
  const companyId = await seedCompany();
  const companyResult = await supabase
    .from("obx_empresas")
    .select("fuso_horario")
    .eq("id", companyId)
    .single();
  requireSuccess(companyResult.error);
  if (!companyResult.data) throw new Error("Não foi possível carregar o fuso horário da empresa.");
  const fusoHorario = companyResult.data.fuso_horario;
  const userRows = people.map((person) => ({
    id: users.get(person.email)!,
    nome: person.nome,
    email: person.email,
  }));
  const profiles = await supabase.from("obx_usuarios").upsert(userRows, { onConflict: "id" });
  requireSuccess(profiles.error);

  const memberships = people.map((person) => ({
    empresa_id: companyId,
    usuario_id: users.get(person.email)!,
    perfil: person.perfil,
  }));
  const memberResult = await supabase
    .from("obx_empresa_membros")
    .upsert(memberships, { onConflict: "empresa_id,usuario_id" });
  requireSuccess(memberResult.error);

  const centerRows = centers.map((center) => ({
    empresa_id: companyId,
    codigo: center.codigo,
    nome: center.nome,
  }));
  const centerResult = await supabase
    .from("obx_centros_custo")
    .upsert(centerRows, { onConflict: "empresa_id,codigo" });
  requireSuccess(centerResult.error);
  const centerLookup = await supabase
    .from("obx_centros_custo")
    .select("id,codigo")
    .eq("empresa_id", companyId);
  requireSuccess(centerLookup.error);
  const centerIds = new Map((centerLookup.data ?? []).map((center) => [center.codigo, center.id]));

  const workSpecs = [
    {
      codigo: "OBX-001",
      nome: "Residência Alto Padrão",
      cliente: "Família Oliveira",
      endereco: "Rua das Palmeiras, 420",
      cidade: "Campinas",
      uf: "SP",
      data_inicio: daysAgo(95, fusoHorario),
      data_fim_prevista: daysAgo(-145, fusoHorario),
      valor_contrato: 1680000,
      status: "em_andamento",
      stages: residenceStages,
    },
    {
      codigo: "OBX-002",
      nome: "Edifício Residencial Jardim",
      cliente: "Incorporadora Horizonte",
      endereco: "Avenida Central, 1150",
      cidade: "Jundiaí",
      uf: "SP",
      data_inicio: daysAgo(180, fusoHorario),
      data_fim_prevista: daysAgo(-300, fusoHorario),
      valor_contrato: 4850000,
      status: "em_andamento",
      stages: buildingStages,
    },
  ];
  const workIds: string[] = [];
  const eapByWork: { id: string; codigo: string; descricao: string; quantidade: number; custo_unitario: number; centro_custo_id: string | null }[][] = [];

  for (const work of workSpecs) {
    const { data, error } = await supabase
      .from("obx_obras")
      .upsert({
        empresa_id: companyId,
        codigo: work.codigo,
        nome: work.nome,
        cliente: work.cliente,
        endereco: work.endereco,
        cidade: work.cidade,
        uf: work.uf,
        data_inicio: work.data_inicio,
        data_fim_prevista: work.data_fim_prevista,
        valor_contrato: work.valor_contrato,
        status: work.status,
        responsavel_id: users.get("engenheiro@obratrix.demo"),
      }, { onConflict: "empresa_id,codigo" })
      .select("id")
      .single();
    requireSuccess(error);
    const workId = data!.id as string;
    workIds.push(workId);
    eapByWork.push(await upsertEap(workId, work.stages, centerIds));
  }

  const workMembers = [
    ...workIds.flatMap((obra_id) => [
      { obra_id, usuario_id: users.get("diretor@obratrix.demo")! },
      { obra_id, usuario_id: users.get("engenheiro@obratrix.demo")! },
    ]),
    { obra_id: workIds[0]!, usuario_id: users.get("encarregado@obratrix.demo")! },
  ];
  const workMemberResult = await supabase
    .from("obx_obra_membros")
    .upsert(workMembers, { onConflict: "obra_id,usuario_id" });
  requireSuccess(workMemberResult.error);

  let rdoCount = 0;
  for (let index = 0; index < workIds.length; index += 1) {
    const result = await seedRdos(workIds[index]!, eapByWork[index]!, users, centerIds, index, fusoHorario);
    rdoCount += result.productionCount;
  }

  console.log(
    `Seed concluído: ${people.length} usuários, ${workIds.length} obras, `
    + `${eapByWork.reduce((sum, entries) => sum + entries.length, 0)} serviços EAP e `
    + `${rdoCount} registros diários de produção.`,
  );

  const { data: seededRdos, error: rdosError } = await supabase
    .from("obx_rdos").select("id,obra_id,data,status").in("obra_id", workIds);
  requireSuccess(rdosError);
  const seededRdoIds = (seededRdos ?? []).map((rdo) => rdo.id);
  const [{ data: seededCosts, error: costsError }, { data: seededServices, error: servicesError }, { data: seededCenters, error: centersError }] = await Promise.all([
    supabase.from("obx_custos").select("obra_id,data,valor,eap_item_id,centro_custo_id").in("obra_id", workIds),
    supabase.from("obx_eap_itens").select("id,obra_id,codigo,descricao,quantidade,custo_unitario,custo_total,centro_custo_id").eq("tipo", "servico").in("obra_id", workIds),
    supabase.from("obx_centros_custo").select("id,nome").eq("empresa_id", companyId),
  ]);
  const seededProduction: { rdo_id: string; eap_item_id: string; quantidade: number }[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from("obx_rdo_producao")
      .select("id,rdo_id,eap_item_id,quantidade").in("rdo_id", seededRdoIds)
      .order("id").range(start, start + 999);
    requireSuccess(error);
    seededProduction.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  requireSuccess(costsError);
  requireSuccess(servicesError);
  requireSuccess(centersError);
  const rdoById = new Map((seededRdos ?? []).map((rdo) => [rdo.id, rdo]));
  for (let index = 0; index < workIds.length; index += 1) {
    const obraId = workIds[index]!;
    const spec = workSpecs[index]!;
    const obraRdos = (seededRdos ?? []).filter((rdo) => rdo.obra_id === obraId);
    const productions = (seededProduction ?? []).flatMap((row) => {
      const rdo = rdoById.get(row.rdo_id);
      return rdo?.obra_id === obraId
        ? [{ eap_item_id: row.eap_item_id, quantidade: Number(row.quantidade), data: rdo.data, rdo_status: rdo.status }]
        : [];
    });
    const metrics = calcularIndicadores({
      obraId,
      dataInicio: spec.data_inicio,
      dataFimPrevista: spec.data_fim_prevista,
      servicos: (seededServices ?? []).filter((item) => item.obra_id === obraId),
      producoes: productions,
      custos: (seededCosts ?? []).filter((item) => item.obra_id === obraId).map((item) => ({ ...item, valor: Number(item.valor) })),
      centros: seededCenters ?? [],
    }, dataHoje(fusoHorario));
    const weeklyEV = metrics.curvaS.map((point, pointIndex, weeks) => ({
      semana: point.semana,
      valor: point.valorAgregado - (weeks[pointIndex - 1]?.valorAgregado ?? 0),
    }));
    const alerts = avaliarAlertas({
      ...metrics,
      obraId,
      status: spec.status,
      rdos: obraRdos,
      producaoAcima: metrics.porServico.filter((item) => item.quantidadeExecutada > item.quantidadeOrcada)
        .map(({ id, codigo, quantidadeExecutada, quantidadeOrcada }) => ({ id, codigo, quantidadeExecutada, quantidadeOrcada })),
      semanasEV: weeklyEV,
    }, dataHoje(fusoHorario));
    console.log(
      `${spec.codigo}: IDC ${metrics.idc?.toFixed(2) ?? "—"} · IDP ${metrics.idp?.toFixed(2) ?? "—"} · `
      + `EAC ${metrics.custoFinalPrevisto.toFixed(2)} · Alertas: ${alerts.map((item) => item.titulo).join("; ") || "nenhum"}`,
    );
  }
}

await main();
