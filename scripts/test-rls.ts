import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { getDatabaseUrl } from "./schema-catalog";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(getDatabaseUrl(), { max: 1, onnotice: () => {} });

async function findUserId(email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((entry) => entry.email === email);
  if (!user) throw new Error(`Usuário de seed não encontrado: ${email}`);
  return user.id;
}

async function assertAsUser<T>(
  userId: string,
  check: (tx: postgres.TransactionSql) => Promise<T>,
) {
  return sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    return check(tx);
  });
}

const directorId = await findUserId("diretor@obratrix.demo");
const engineerId = await findUserId("engenheiro@obratrix.demo");
const foremanId = await findUserId("encarregado@obratrix.demo");
const financeId = await findUserId("financeiro@obratrix.demo");
const companies = await sql<{ id: string }[]>`
  select id from public.obx_empresas where nome = 'Construtora Exemplo Ltda'
`;
if (!companies[0]) throw new Error("Execute pnpm db:seed antes dos testes RLS.");

const workRows = await sql<{ id: string }[]>`
  select id from public.obx_obras where empresa_id = ${companies[0].id} order by codigo
`;
if (workRows.length < 2) throw new Error("O seed precisa criar duas obras.");
const workId = workRows[0]!.id;
const eapRows = await sql<{ id: string }[]>`
  select id from public.obx_eap_itens where obra_id = ${workId} and tipo = 'servico' limit 1
`;
if (!eapRows[0]) throw new Error("O seed precisa criar serviços de EAP.");
const hasCostInsertGrant = await sql<{ allowed: boolean }[]>`
  select has_table_privilege('authenticated', 'public.obx_custos', 'INSERT') as allowed
`;
if (!hasCostInsertGrant[0]?.allowed) {
  throw new Error("O teste de custo exige INSERT concedido para authenticated, bloqueado apenas por RLS.");
}
const auditInsertGrants = await sql<{ authenticated: boolean; service_role: boolean }[]>`
  select
    has_table_privilege('authenticated', 'public.obx_auditoria', 'INSERT') as authenticated,
    has_table_privilege('service_role', 'public.obx_auditoria', 'INSERT') as service_role
`;
if (auditInsertGrants[0]?.authenticated || auditInsertGrants[0]?.service_role) {
  throw new Error("obx_auditoria não deve conceder INSERT direto a authenticated nem service_role.");
}

const temporaryEmail = `rls-check-${randomUUID()}@obratrix.test`;
let temporaryUserId: string | undefined;
let temporaryCompanyId: string | undefined;

try {
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email: temporaryEmail,
    password: `${randomUUID()}aA1!`,
    email_confirm: true,
    user_metadata: { nome: "Usuário de verificação RLS" },
  });
  if (createUserError || !createdUser.user) throw createUserError ?? new Error("Falha ao criar usuário temporário.");
  temporaryUserId = createdUser.user.id;

  const insertedCompany = await sql<{ id: string }[]>`
    insert into public.obx_empresas (nome)
    values (${`Empresa isolada ${randomUUID()}`})
    returning id
  `;
  temporaryCompanyId = insertedCompany[0]!.id;
  await sql`
    insert into public.obx_empresa_membros (empresa_id, usuario_id, perfil)
    values (${temporaryCompanyId}, ${temporaryUserId}, 'diretor')
  `;

  const unrelatedWorks = await assertAsUser(temporaryUserId, async (tx) => (
    tx<{ id: string }[]>`select id from public.obx_obras where empresa_id = ${companies[0]!.id}`
  ));
  if (unrelatedWorks.length !== 0) throw new Error("(a) usuário de outra empresa viu obras da Construtora Exemplo.");
  console.log("PASS (a): usuário de outra empresa não vê obras da Construtora Exemplo.");

  const foremanWorks = await assertAsUser(foremanId, async (tx) => (
    tx<{ id: string }[]>`select id from public.obx_obras where empresa_id = ${companies[0]!.id}`
  ));
  if (foremanWorks.length !== 1 || foremanWorks[0]!.id !== workId) {
    throw new Error("(b) encarregado não ficou restrito à única obra em que é membro.");
  }

  let costInsertBlocked = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        insert into public.obx_custos (obra_id, categoria, descricao, data, valor, criado_por)
        values (${workId}, 'material', 'Teste RLS', current_date, 1, ${foremanId})
      `
    ));
  } catch (error) {
    const postgresError = error as { code?: string; message?: string };
    costInsertBlocked = postgresError.code === "42501"
      && postgresError.message?.toLowerCase().includes("row-level security") === true;
  }
  if (!costInsertBlocked) throw new Error("(b) encarregado conseguiu inserir custo ou a negação não foi RLS.");
  console.log("PASS (b): encarregado só vê obra membro e não consegue inserir custo.");

  const financeWorks = await assertAsUser(financeId, async (tx) => (
    tx<{ id: string }[]>`select id from public.obx_obras where empresa_id = ${companies[0]!.id}`
  ));
  if (financeWorks.length !== workRows.length) {
    throw new Error("(c) financeiro não conseguiu ver todas as obras da empresa.");
  }

  const financeEapUpdate = await assertAsUser(financeId, async (tx) => (
    tx<{ id: string }[]>`
      update public.obx_eap_itens
      set descricao = descricao
      where id = ${eapRows[0]!.id}
      returning id
    `
  ));
  if (financeEapUpdate.length !== 0) throw new Error("(c) financeiro conseguiu editar EAP.");
  console.log("PASS (c): financeiro vê todas as obras e não edita EAP.");

  const engineerEapUpdate = await assertAsUser(engineerId, async (tx) => {
    await tx`savepoint obx_test_eap`;
    const updated = await tx<{ id: string }[]>`
      update public.obx_eap_itens
      set descricao = descricao
      where id = ${eapRows[0]!.id}
      returning id
    `;
    await tx`rollback to savepoint obx_test_eap`;
    return updated;
  });
  if (engineerEapUpdate.length !== 1) throw new Error("Engenheiro membro não conseguiu editar EAP.");
  console.log("PASS: engenheiro vinculado pode editar EAP.");

  const directorAudit = await assertAsUser(directorId, async (tx) => (
    tx<{ total: number }[]>`
      select count(*)::int as total from public.obx_auditoria where empresa_id = ${companies[0]!.id}
    `
  ));
  const foremanAudit = await assertAsUser(foremanId, async (tx) => (
    tx<{ total: number }[]>`
      select count(*)::int as total from public.obx_auditoria where empresa_id = ${companies[0]!.id}
    `
  ));
  if (!Number(directorAudit[0]?.total) || Number(foremanAudit[0]?.total) !== 0) {
    throw new Error("A auditoria deve ser visível à diretoria e invisível ao encarregado.");
  }
  console.log("PASS: auditoria só pode ser lida pela diretoria; INSERT direto está revogado.");

  const profile = await sql<{ id: string; email: string }[]>`
    select id, email from public.obx_usuarios where id = ${temporaryUserId}
  `;
  if (profile.length !== 1) throw new Error("O trigger de auth.users não criou o perfil do usuário.");
  console.log("PASS: trigger obx_trg_novo_usuario criou o perfil de usuário.");
} finally {
  if (temporaryCompanyId) {
    await sql`delete from public.obx_empresas where id = ${temporaryCompanyId}`;
  }
  if (temporaryUserId) {
    await admin.auth.admin.deleteUser(temporaryUserId);
  }
  await sql.end();
}
