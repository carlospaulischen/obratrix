import postgres from "postgres";

export const schemaCatalogQuery = `
  select 'pg_class' as catalog, c.relname as name
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'S', 'i', 'I', 'f')
  union all
  select 'pg_type', t.typname
  from pg_catalog.pg_type as t
  join pg_catalog.pg_namespace as n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typtype in ('c', 'd', 'e', 'r', 'm')
  union all
  select 'pg_proc', p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')'
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
  union all
  select 'pg_trigger', t.tgname
  from pg_catalog.pg_trigger as t
  join pg_catalog.pg_class as c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
  union all
  select 'pg_policy', p.polname
  from pg_catalog.pg_policy as p
  join pg_catalog.pg_class as c on c.oid = p.polrelid
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
  order by catalog, name
`;

export const baselinePath = `${process.cwd()}/.obx-schema-baseline.json`;

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Defina DATABASE_URL para conectar ao Supabase local.");
  }
  return databaseUrl;
}

export async function openDatabase() {
  return postgres(getDatabaseUrl(), { max: 1, onnotice: () => {} });
}

export type CatalogObject = { catalog: string; name: string };
