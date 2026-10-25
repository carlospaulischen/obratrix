import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { getDatabaseUrl } from "./schema-catalog";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.");
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
const companies = await sql<{ id: string; fuso_horario: string }[]>`
  select id, fuso_horario from public.obx_empresas where nome = 'Construtora Exemplo Ltda'
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
const serviceRows = await sql<{ id: string; codigo: string; centro_custo_id: string | null }[]>`
  select id, codigo, centro_custo_id from public.obx_eap_itens
  where obra_id = ${workId} and tipo = 'servico' order by codigo limit 1
`;
const otherWorkServices = await sql<{ id: string }[]>`
  select id from public.obx_eap_itens
  where obra_id = ${workRows[1]!.id} and tipo = 'servico' limit 1
`;
if (!serviceRows[0] || !otherWorkServices[0]) throw new Error("O seed precisa criar serviços nas duas obras.");
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
let temporaryRdoId: string | undefined;
const temporaryRdoIds: string[] = [];
const temporaryAuthUsers: string[] = [];
const uploadedStoragePaths: string[] = [];

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
  const foreignCenter = await sql<{ id: string }[]>`
    insert into public.obx_centros_custo (empresa_id, codigo, nome)
    values (${temporaryCompanyId}, 'OUTRO', 'Centro externo')
    returning id
  `;
  const temporaryRdo = await sql<{ id: string }[]>`
    insert into public.obx_rdos (obra_id, data, criado_por)
    values (${workId}, current_date + 100, ${foremanId})
    returning id
  `;
  const draftRdoId = temporaryRdo[0]!.id;
  temporaryRdoId = draftRdoId;

  const emptyPayload = {
    clima_manha: null,
    clima_tarde: null,
    observacoes: "",
    mao_obra: [],
    producao: [],
    equipamentos: [],
    materiais: [],
    ocorrencias: [],
  };
  const savedRdo = await assertAsUser(foremanId, async (tx) => (
    tx<{ id: string }[]>`
      select public.obx_fn_salvar_rdo(
        ${workId},
        current_date - 200,
        ${sql.json(emptyPayload)}
      ) as id
    `
  ));
  const savedRdoId = savedRdo[0]?.id;
  if (!savedRdoId) throw new Error("Encarregado membro não salvou o RDO pela RPC.");
  temporaryRdoIds.push(savedRdoId);
  console.log("PASS: encarregado membro salva RDO de rascunho pela RPC.");

  const invalidDateResult = await sql<{ data: string }[]>`
    select (current_date - 203)::text as data
  `;
  const invalidDate = invalidDateResult[0]!.data;
  const invalidPayload = {
    ...emptyPayload,
    mao_obra: [{ funcao: "Pedreiro", quantidade: "inválido", horas: 8 }],
  };
  let invalidPayloadRejected = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        select public.obx_fn_salvar_rdo(
          ${workId},
          ${invalidDate}::date,
          ${sql.json(invalidPayload)}
        )
      `
    ));
  } catch (error) {
    invalidPayloadRejected = (error as { code?: string }).code === "22P02";
  }
  if (!invalidPayloadRejected) throw new Error("A RPC não rejeitou o payload inválido de mão de obra.");
  const invalidPayloadRows = await sql<{
    rdos: number;
    mao_obra: number;
    producao: number;
    equipamentos: number;
    materiais: number;
    ocorrencias: number;
  }[]>`
    select
      (select count(*)::int from public.obx_rdos where obra_id = ${workId} and data = ${invalidDate}::date) as rdos,
      (select count(*)::int from public.obx_rdo_mao_obra m join public.obx_rdos r on r.id = m.rdo_id where r.obra_id = ${workId} and r.data = ${invalidDate}::date) as mao_obra,
      (select count(*)::int from public.obx_rdo_producao p join public.obx_rdos r on r.id = p.rdo_id where r.obra_id = ${workId} and r.data = ${invalidDate}::date) as producao,
      (select count(*)::int from public.obx_rdo_equipamentos e join public.obx_rdos r on r.id = e.rdo_id where r.obra_id = ${workId} and r.data = ${invalidDate}::date) as equipamentos,
      (select count(*)::int from public.obx_rdo_materiais m join public.obx_rdos r on r.id = m.rdo_id where r.obra_id = ${workId} and r.data = ${invalidDate}::date) as materiais,
      (select count(*)::int from public.obx_rdo_ocorrencias o join public.obx_rdos r on r.id = o.rdo_id where r.obra_id = ${workId} and r.data = ${invalidDate}::date) as ocorrencias
  `;
  if (Object.values(invalidPayloadRows[0]!).some((count) => count !== 0)) {
    throw new Error("A RPC deixou o cabeçalho ou filhos de um payload inválido persistidos.");
  }
  console.log("PASS: payload inválido não persiste cabeçalho nem filhos do RDO.");

  const futureDateResult = await sql<{ data: string }[]>`
    select ((now() at time zone ${companies[0]!.fuso_horario})::date + 1)::text as data
  `;
  const futureDate = futureDateResult[0]!.data;
  let futureDateBlocked = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        select public.obx_fn_salvar_rdo(
          ${workId},
          ${futureDate}::date,
          ${sql.json(emptyPayload)}
        )
      `
    ));
  } catch (error) {
    futureDateBlocked = (error as { message?: string }).message?.includes("data futura") === true;
  }
  if (!futureDateBlocked) throw new Error("A RPC aceitou uma data futura no fuso da empresa.");
  const futureRows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.obx_rdos
    where obra_id = ${workId} and data = ${futureDate}::date
  `;
  if (futureRows[0]?.count !== 0) throw new Error("A RPC deixou RDO com data futura persistido.");
  console.log("PASS: a RPC recusa data futura calculada no fuso da empresa.");

  const otherWorkRdo = await sql<{ id: string }[]>`
    insert into public.obx_rdos (obra_id, data, criado_por)
    values (${workRows[1]!.id}, current_date - 200, ${foremanId})
    returning id
  `;
  temporaryRdoIds.push(otherWorkRdo[0]!.id);

  const nonMemberEmail = `rls-nonmember-${randomUUID()}@obratrix.test`;
  const nonMemberPassword = `${randomUUID()}aA1!`;
  const { data: nonMemberCreated, error: nonMemberError } = await admin.auth.admin.createUser({
    email: nonMemberEmail,
    password: nonMemberPassword,
    email_confirm: true,
    user_metadata: { nome: "Encarregado sem obra" },
  });
  if (nonMemberError || !nonMemberCreated.user) throw nonMemberError ?? new Error("Falha ao criar encarregado sem obra.");
  temporaryAuthUsers.push(nonMemberCreated.user.id);
  await sql`
    insert into public.obx_empresa_membros (empresa_id, usuario_id, perfil)
    values (${companies[0]!.id}, ${nonMemberCreated.user.id}, 'encarregado')
  `;

  let nonMemberSaveBlocked = false;
  try {
    await assertAsUser(nonMemberCreated.user.id, async (tx) => (
      tx`
        select public.obx_fn_salvar_rdo(
          ${workRows[1]!.id},
          current_date - 202,
          ${JSON.stringify(emptyPayload)}::jsonb
        )
      `
    ));
  } catch {
    nonMemberSaveBlocked = true;
  }
  if (!nonMemberSaveBlocked) throw new Error("Encarregado sem vínculo conseguiu salvar RDO.");
  console.log("PASS: encarregado não membro não consegue salvar RDO.");

  const confirmedRdo = await sql<{ id: string }[]>`
    insert into public.obx_rdos (obra_id, data, criado_por, status, confirmado_por, confirmado_em)
    values (${workId}, current_date - 201, ${foremanId}, 'confirmado', ${engineerId}, now())
    returning id
  `;
  temporaryRdoIds.push(confirmedRdo[0]!.id);
  let confirmedRdoSaveBlocked = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        select public.obx_fn_salvar_rdo(
          ${workId},
          current_date - 201,
          ${JSON.stringify(emptyPayload)}::jsonb
        )
      `
    ));
  } catch {
    confirmedRdoSaveBlocked = true;
  }
  if (!confirmedRdoSaveBlocked) throw new Error("Encarregado conseguiu alterar RDO confirmado.");
  console.log("PASS: encarregado não consegue alterar RDO confirmado.");

  const storageUser = async (profile: "encarregado" | "financeiro", addWorkMember: boolean) => {
    const email = `storage-${randomUUID()}@obratrix.test`;
    const password = `${randomUUID()}aA1!`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: "Usuário de teste do Storage" },
    });
    if (error || !data.user) throw error ?? new Error("Falha ao criar usuário de Storage.");
    temporaryAuthUsers.push(data.user.id);
    await sql`
      insert into public.obx_empresa_membros (empresa_id, usuario_id, perfil)
      values (${companies[0]!.id}, ${data.user.id}, ${profile})
    `;
    if (addWorkMember) {
      await sql`
        insert into public.obx_obra_membros (obra_id, usuario_id)
        values (${workId}, ${data.user.id})
      `;
    }
    const client = createClient(supabaseUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return client;
  };

  const storageMember = await storageUser("encarregado", true);
  const allowedPath = `${workId}/${savedRdoId}/${randomUUID()}.jpg`;
  const allowedUpload = await storageMember.storage.from("obx_fotos").upload(
    allowedPath,
    new Uint8Array([255, 216, 255, 217]),
    { contentType: "image/jpeg" },
  );
  if (allowedUpload.error) throw new Error(`Encarregado membro não conseguiu enviar foto: ${allowedUpload.error.message}`);
  uploadedStoragePaths.push(allowedPath);
  console.log("PASS: encarregado membro consegue enviar foto no Storage.");

  const storageNonMember = await storageUser("encarregado", false);
  const blockedNonMemberPath = `${workRows[1]!.id}/${otherWorkRdo[0]!.id}/${randomUUID()}.jpg`;
  const blockedNonMemberUpload = await storageNonMember.storage.from("obx_fotos").upload(
    blockedNonMemberPath,
    new Uint8Array([255, 216, 255, 217]),
    { contentType: "image/jpeg" },
  );
  if (!blockedNonMemberUpload.error) throw new Error("Encarregado sem vínculo enviou foto para obra alheia.");
  console.log("PASS: Storage bloqueia upload em obra sem vínculo.");

  const storageFinance = await storageUser("financeiro", false);
  const blockedFinanceUpload = await storageFinance.storage.from("obx_fotos").upload(
    `${workId}/${savedRdoId}/${randomUUID()}.jpg`,
    new Uint8Array([255, 216, 255, 217]),
    { contentType: "image/jpeg" },
  );
  if (!blockedFinanceUpload.error) throw new Error("Financeiro conseguiu enviar foto ao Storage.");
  console.log("PASS: Storage bloqueia upload pelo perfil financeiro.");

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
  const foremanCosts = await assertAsUser(foremanId, async (tx) => (
    tx<{ total: number }[]>`
      select count(*)::int as total
      from public.obx_custos
      where obra_id = ${workId}
    `
  ));
  if (Number(foremanCosts[0]?.total) !== 0) {
    throw new Error("Encarregado conseguiu ler custos da obra.");
  }
  console.log("PASS: encarregado não consegue ler custos.");

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
  const financeCostInsert = await assertAsUser(financeId, async (tx) => {
    await tx`savepoint obx_test_cost_insert`;
    const inserted = await tx<{ id: string; centro_custo_id: string | null }[]>`
      insert into public.obx_custos (obra_id, eap_item_id, categoria, descricao, data, valor, criado_por)
      values (${workId}, ${serviceRows[0]!.id}, 'material', 'Teste de inserção RLS', current_date, 1, ${financeId})
      returning id, centro_custo_id
    `;
    await tx`rollback to savepoint obx_test_cost_insert`;
    return inserted;
  });
  if (financeCostInsert.length !== 1 || financeCostInsert[0]!.centro_custo_id !== serviceRows[0]!.centro_custo_id) {
    throw new Error("Financeiro não conseguiu inserir custo ou o centro do serviço não foi herdado.");
  }
  console.log("PASS: financeiro insere custo e herda centro de custo do serviço.");

  let crossWorkServiceBlocked = false;
  try {
    await assertAsUser(financeId, async (tx) => (
      tx`
        insert into public.obx_custos (
          obra_id, eap_item_id, categoria, descricao, data, valor, criado_por
        )
        values (
          ${workId}, ${otherWorkServices[0]!.id}, 'material',
          'Serviço de outra obra', current_date, 1, ${financeId}
        )
      `
    ));
  } catch (error) {
    crossWorkServiceBlocked = (error as { code?: string }).code === "23514";
  }
  if (!crossWorkServiceBlocked) throw new Error("Custo aceitou serviço EAP de outra obra.");
  console.log("PASS: custo rejeita serviço EAP de outra obra.");

  let foreignCenterBlocked = false;
  try {
    await assertAsUser(financeId, async (tx) => (
      tx`
        insert into public.obx_custos (
          obra_id, centro_custo_id, categoria, descricao, data, valor, criado_por
        )
        values (
          ${workId}, ${foreignCenter[0]!.id}, 'material',
          'Centro de outra empresa', current_date, 1, ${financeId}
        )
      `
    ));
  } catch (error) {
    foreignCenterBlocked = (error as { code?: string }).code === "23514";
  }
  if (!foreignCenterBlocked) throw new Error("Custo aceitou centro de custo de outra empresa.");
  console.log("PASS: custo rejeita centro de custo de outra empresa.");

  const todayInCompany = await sql<{ data: string }[]>`
    select (now() at time zone ${companies[0]!.fuso_horario})::date::text as data
  `;
  const invalidImportDescription = `Importação atômica ${randomUUID()}`;
  const invalidImportItems = [
    {
      data: todayInCompany[0]!.data,
      descricao: invalidImportDescription,
      categoria: "material",
      valor: 1,
      codigo_eap: serviceRows[0]!.codigo,
    },
    {
      data: todayInCompany[0]!.data,
      descricao: `${invalidImportDescription} inválida`,
      categoria: "material",
      valor: 0,
    },
  ];
  let invalidImportBlocked = false;
  try {
    await assertAsUser(financeId, async (tx) => (
      tx`select public.obx_fn_importar_custos(${workId}, ${sql.json(invalidImportItems)}::jsonb)`
    ));
  } catch (error) {
    invalidImportBlocked = (error as { code?: string }).code === "22023";
  }
  const persistedInvalidImport = await sql<{ total: number }[]>`
    select count(*)::int as total from public.obx_custos
    where obra_id = ${workId} and descricao like ${`${invalidImportDescription}%`}
  `;
  if (!invalidImportBlocked || Number(persistedInvalidImport[0]?.total) !== 0) {
    throw new Error("Importação inválida não foi atômica.");
  }
  console.log("PASS: importação com item inválido não persiste nenhum custo.");

  const futureCostDate = await sql<{ data: string }[]>`
    select ((now() at time zone ${companies[0]!.fuso_horario})::date + 1)::text as data
  `;
  let futureCostBlocked = false;
  try {
    await assertAsUser(financeId, async (tx) => (
      tx`select public.obx_fn_importar_custos(
        ${workId},
        ${sql.json([{
          data: futureCostDate[0]!.data,
          descricao: "Custo futuro",
          categoria: "material",
          valor: 1,
        }])}::jsonb
      )`
    ));
  } catch (error) {
    futureCostBlocked = (error as { code?: string }).code === "22023";
  }
  if (!futureCostBlocked) throw new Error("Importação aceitou custo em data futura.");
  console.log("PASS: importação rejeita data futura no fuso da empresa.");

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

  let foremanConfirmationBlocked = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        update public.obx_rdos
        set status = 'confirmado', confirmado_por = ${foremanId}, confirmado_em = now()
        where id = ${draftRdoId}
      `
    ));
  } catch (error) {
    foremanConfirmationBlocked = isRlsDenied(error);
  }
  if (!foremanConfirmationBlocked) {
    throw new Error("Encarregado conseguiu confirmar um RDO.");
  }
  console.log("PASS: encarregado não consegue confirmar RDO.");

  const engineerConfirmation = await assertAsUser(engineerId, async (tx) => {
    await tx`savepoint obx_test_rdo_confirmation`;
    const updated = await tx<{ id: string }[]>`
      update public.obx_rdos
      set status = 'confirmado', confirmado_por = ${engineerId}, confirmado_em = now()
      where id = ${draftRdoId}
      returning id
    `;
    await tx`rollback to savepoint obx_test_rdo_confirmation`;
    return updated;
  });
  if (engineerConfirmation.length !== 1) {
    throw new Error("Engenheiro membro não conseguiu confirmar RDO.");
  }
  console.log("PASS: engenheiro membro consegue confirmar RDO.");

  let forgedConfirmationBlocked = false;
  try {
    await assertAsUser(engineerId, async (tx) => (
      tx`
        update public.obx_rdos
        set status = 'confirmado', confirmado_por = ${directorId}, confirmado_em = now()
        where id = ${draftRdoId}
      `
    ));
  } catch (error) {
    forgedConfirmationBlocked = isRlsDenied(error);
  }
  if (!forgedConfirmationBlocked) {
    throw new Error("Engenheiro conseguiu confirmar RDO em nome de outro usuário.");
  }
  console.log("PASS: RDO não pode ser confirmado em nome de outro usuário.");

  let moveToUnassignedWorkBlocked = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        update public.obx_rdos
        set obra_id = ${workRows[1]!.id}
        where id = ${draftRdoId}
      `
    ));
  } catch (error) {
    moveToUnassignedWorkBlocked = isRlsDenied(error);
  }
  if (!moveToUnassignedWorkBlocked) {
    throw new Error("Encarregado conseguiu mover RDO para uma obra sem vínculo.");
  }
  console.log("PASS: RDO não pode ser movido para obra sem vínculo.");

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

  const foremanPlanos = await assertAsUser(foremanId, async (tx) => (
    tx<{ id: string }[]>`select id from public.obx_planos_semanais where obra_id = ${workId} limit 1`
  ));
  if (!foremanPlanos.length) throw new Error("Encarregado membro não consegue ler plano semanal.");
  console.log("PASS: encarregado membro lê plano semanal da obra.");

  let foremanPlanoBlocked = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        select public.obx_fn_salvar_plano_semanal(
          ${workId}, (date_trunc('week', current_date)::date + 371),
          ${sql.json([{ eap_item_id: serviceRows[0]!.id, quantidade_planejada: 1 }])}::jsonb
        )
      `
    ));
  } catch (error) {
    foremanPlanoBlocked = (error as { code?: string }).code === "42501";
  }
  if (!foremanPlanoBlocked) throw new Error("Encarregado conseguiu salvar plano semanal pela RPC.");
  console.log("PASS: RPC de plano semanal nega encarregado.");

  let foremanPlanoInsertBlocked = false;
  try {
    await assertAsUser(foremanId, async (tx) => (
      tx`
        insert into public.obx_planos_semanais (obra_id, semana_inicio)
        values (${workId}, (date_trunc('week', current_date)::date + 378))
      `
    ));
  } catch (error) {
    foremanPlanoInsertBlocked = isRlsDenied(error);
  }
  if (!foremanPlanoInsertBlocked) throw new Error("Encarregado inseriu plano semanal diretamente.");
  console.log("PASS: insert direto de plano semanal é negado pelo RLS para encarregado.");

  const engineerPlano = await assertAsUser(engineerId, async (tx) => (
    tx<{ obx_fn_salvar_plano_semanal: string }[]>`
      select public.obx_fn_salvar_plano_semanal(
        ${workId}, (date_trunc('week', current_date)::date + 371),
        ${sql.json([{ eap_item_id: serviceRows[0]!.id, quantidade_planejada: 1 }])}::jsonb
      ) as obx_fn_salvar_plano_semanal
    `
  ));
  const engineerPlanoId = engineerPlano[0]?.obx_fn_salvar_plano_semanal;
  if (!engineerPlanoId) throw new Error("Engenheiro membro não conseguiu salvar plano semanal.");
  console.log("PASS: engenheiro membro salva plano semanal pela RPC.");

  let foreignServiceBlocked = false;
  try {
    await assertAsUser(engineerId, async (tx) => (
      tx`
        select public.obx_fn_salvar_plano_semanal(
          ${workId}, (date_trunc('week', current_date)::date + 371),
          ${sql.json([{ eap_item_id: otherWorkServices[0]!.id, quantidade_planejada: 1 }])}::jsonb
        )
      `
    ));
  } catch (error) {
    foreignServiceBlocked = (error as { code?: string }).code === "23514";
  }
  if (!foreignServiceBlocked) throw new Error("Plano semanal aceitou serviço de outra obra.");
  console.log("PASS: plano semanal rejeita serviço de outra obra.");

  const foreignPlanos = await assertAsUser(temporaryUserId, async (tx) => (
    tx<{ id: string }[]>`select id from public.obx_planos_semanais where obra_id = ${workId}`
  ));
  if (foreignPlanos.length !== 0) throw new Error("Usuário de outra empresa leu plano semanal.");
  console.log("PASS: plano semanal invisível para outra empresa.");

  const foremanDatesUpdate = await assertAsUser(foremanId, async (tx) => (
    tx`
      update public.obx_eap_itens
      set inicio_previsto = current_date
      where id = ${serviceRows[0]!.id}
    `
  ));
  if (foremanDatesUpdate.count !== 0) throw new Error("Encarregado alterou datas do cronograma.");
  console.log("PASS: encarregado não edita datas do cronograma (RLS).");

  const directorDatesUpdate = await assertAsUser(directorId, async (tx) => {
    await tx`savepoint obx_test_datas`;
    const updated = await tx`
      update public.obx_eap_itens
      set inicio_previsto = current_date, fim_previsto = current_date + 7
      where id = ${serviceRows[0]!.id}
    `;
    await tx`rollback to savepoint obx_test_datas`;
    return updated;
  });
  if (directorDatesUpdate.count !== 1) throw new Error("Diretor não conseguiu editar datas do cronograma.");
  console.log("PASS: diretor edita datas do cronograma.");

  await sql`delete from public.obx_planos_semanais where id = ${engineerPlanoId}`;

  const profile = await sql<{ id: string; email: string }[]>`
    select id, email from public.obx_usuarios where id = ${temporaryUserId}
  `;
  if (profile.length !== 1) throw new Error("O trigger de auth.users não criou o perfil do usuário.");
  console.log("PASS: trigger obx_trg_novo_usuario criou o perfil de usuário.");
} finally {
  if (uploadedStoragePaths.length) {
    await admin.storage.from("obx_fotos").remove(uploadedStoragePaths);
  }
  if (temporaryRdoIds.length) {
    await sql`delete from public.obx_rdos where id in ${sql(temporaryRdoIds)}`;
  }
  if (temporaryRdoId) {
    await sql`delete from public.obx_rdos where id = ${temporaryRdoId}`;
  }
  for (const userId of temporaryAuthUsers) {
    await admin.auth.admin.deleteUser(userId);
  }
  if (temporaryCompanyId) {
    await sql`delete from public.obx_empresas where id = ${temporaryCompanyId}`;
  }
  if (temporaryUserId) {
    await admin.auth.admin.deleteUser(temporaryUserId);
  }
  await sql.end();
}

function isRlsDenied(error: unknown) {
  const postgresError = error as { code?: string; message?: string };
  return postgresError.code === "42501"
    && postgresError.message?.toLowerCase().includes("row-level security") === true;
}
