create type public.obx_perfil as enum ('diretor', 'engenheiro', 'encarregado', 'financeiro');
create type public.obx_obra_status as enum ('planejamento', 'em_andamento', 'paralisada', 'concluida');
create type public.obx_eap_tipo as enum ('etapa', 'servico');
create type public.obx_rdo_status as enum ('rascunho', 'confirmado');
create type public.obx_custo_categoria as enum ('mao_obra', 'material', 'equipamento', 'servico_terceiro', 'indireto');
create type public.obx_clima as enum ('bom', 'nublado', 'chuva_fraca', 'chuva_forte', 'impraticavel');

create table public.obx_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  locale text not null default 'pt-BR',
  moeda text not null default 'BRL',
  fuso_horario text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.obx_usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.obx_empresa_membros (
  empresa_id uuid not null references public.obx_empresas(id) on delete cascade,
  usuario_id uuid not null references public.obx_usuarios(id) on delete cascade,
  perfil public.obx_perfil not null,
  created_at timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);

create table public.obx_obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.obx_empresas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  cliente text,
  endereco text,
  cidade text,
  uf text,
  data_inicio date,
  data_fim_prevista date,
  valor_contrato numeric(14,2),
  status public.obx_obra_status not null default 'planejamento',
  responsavel_id uuid references public.obx_usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table public.obx_obra_membros (
  obra_id uuid not null references public.obx_obras(id) on delete cascade,
  usuario_id uuid not null references public.obx_usuarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (obra_id, usuario_id)
);

create table public.obx_centros_custo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.obx_empresas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table public.obx_eap_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obx_obras(id) on delete cascade,
  parent_id uuid references public.obx_eap_itens(id) on delete cascade,
  codigo text not null,
  descricao text not null,
  tipo public.obx_eap_tipo not null,
  unidade text,
  quantidade numeric(14,4) not null default 0,
  custo_unitario numeric(14,4) not null default 0,
  custo_total numeric(14,4) generated always as (quantidade * custo_unitario) stored,
  centro_custo_id uuid references public.obx_centros_custo(id) on delete set null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obra_id, codigo)
);

create table public.obx_rdos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obx_obras(id) on delete cascade,
  data date not null,
  clima_manha public.obx_clima,
  clima_tarde public.obx_clima,
  observacoes text,
  status public.obx_rdo_status not null default 'rascunho',
  criado_por uuid not null references public.obx_usuarios(id),
  confirmado_por uuid references public.obx_usuarios(id),
  confirmado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obra_id, data)
);

create table public.obx_rdo_mao_obra (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.obx_rdos(id) on delete cascade,
  funcao text not null,
  quantidade integer not null default 0,
  horas numeric(6,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.obx_rdo_producao (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.obx_rdos(id) on delete cascade,
  eap_item_id uuid not null references public.obx_eap_itens(id) on delete cascade,
  quantidade numeric(14,4) not null,
  observacao text,
  created_at timestamptz not null default now()
);

create table public.obx_rdo_equipamentos (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.obx_rdos(id) on delete cascade,
  equipamento text not null,
  horas_trabalhadas numeric(6,2) not null default 0,
  horas_paradas numeric(6,2) not null default 0,
  motivo_parada text,
  created_at timestamptz not null default now()
);

create table public.obx_rdo_materiais (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.obx_rdos(id) on delete cascade,
  material text not null,
  quantidade numeric(14,4) not null,
  unidade text not null,
  created_at timestamptz not null default now()
);

create table public.obx_rdo_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.obx_rdos(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  hora_inicio time,
  hora_fim time,
  created_at timestamptz not null default now()
);

create table public.obx_fotos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obx_obras(id) on delete cascade,
  rdo_id uuid references public.obx_rdos(id) on delete set null,
  eap_item_id uuid references public.obx_eap_itens(id) on delete set null,
  storage_path text not null,
  legenda text,
  tirada_em timestamptz,
  criado_por uuid not null references public.obx_usuarios(id),
  created_at timestamptz not null default now()
);

create table public.obx_custos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obx_obras(id) on delete cascade,
  eap_item_id uuid references public.obx_eap_itens(id) on delete set null,
  centro_custo_id uuid references public.obx_centros_custo(id) on delete set null,
  categoria public.obx_custo_categoria not null,
  descricao text not null,
  fornecedor text,
  documento text,
  data date not null,
  valor numeric(14,2) not null,
  criado_por uuid not null references public.obx_usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.obx_auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid not null,
  empresa_id uuid not null,
  acao text not null,
  dados_antigos jsonb,
  dados_novos jsonb,
  usuario_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index obx_idx_empresa_membros_usuario on public.obx_empresa_membros(usuario_id);
create index obx_idx_obras_empresa on public.obx_obras(empresa_id);
create index obx_idx_obras_responsavel on public.obx_obras(responsavel_id);
create index obx_idx_obra_membros_usuario on public.obx_obra_membros(usuario_id);
create index obx_idx_centros_custo_empresa on public.obx_centros_custo(empresa_id);
create index obx_idx_eap_itens_obra on public.obx_eap_itens(obra_id);
create index obx_idx_eap_itens_parent on public.obx_eap_itens(parent_id);
create index obx_idx_eap_itens_centro_custo on public.obx_eap_itens(centro_custo_id);
create index obx_idx_rdos_obra on public.obx_rdos(obra_id);
create index obx_idx_rdos_criado_por on public.obx_rdos(criado_por);
create index obx_idx_rdos_confirmado_por on public.obx_rdos(confirmado_por);
create index obx_idx_rdo_mao_obra_rdo on public.obx_rdo_mao_obra(rdo_id);
create index obx_idx_rdo_producao_rdo on public.obx_rdo_producao(rdo_id);
create index obx_idx_rdo_producao_eap on public.obx_rdo_producao(eap_item_id);
create index obx_idx_rdo_equipamentos_rdo on public.obx_rdo_equipamentos(rdo_id);
create index obx_idx_rdo_materiais_rdo on public.obx_rdo_materiais(rdo_id);
create index obx_idx_rdo_ocorrencias_rdo on public.obx_rdo_ocorrencias(rdo_id);
create index obx_idx_fotos_obra on public.obx_fotos(obra_id);
create index obx_idx_fotos_rdo on public.obx_fotos(rdo_id);
create index obx_idx_fotos_eap on public.obx_fotos(eap_item_id);
create index obx_idx_fotos_criado_por on public.obx_fotos(criado_por);
create index obx_idx_custos_obra on public.obx_custos(obra_id);
create index obx_idx_custos_eap on public.obx_custos(eap_item_id);
create index obx_idx_custos_centro_custo on public.obx_custos(centro_custo_id);
create index obx_idx_custos_criado_por on public.obx_custos(criado_por);
create index obx_idx_auditoria_registro on public.obx_auditoria(tabela, registro_id);
create index obx_idx_auditoria_empresa on public.obx_auditoria(empresa_id);
create index obx_idx_auditoria_usuario on public.obx_auditoria(usuario_id);

create function public.obx_fn_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger obx_trg_set_updated_at before update on public.obx_empresas
for each row execute function public.obx_fn_set_updated_at();
create trigger obx_trg_set_updated_at before update on public.obx_usuarios
for each row execute function public.obx_fn_set_updated_at();
create trigger obx_trg_set_updated_at before update on public.obx_obras
for each row execute function public.obx_fn_set_updated_at();
create trigger obx_trg_set_updated_at before update on public.obx_centros_custo
for each row execute function public.obx_fn_set_updated_at();
create trigger obx_trg_set_updated_at before update on public.obx_eap_itens
for each row execute function public.obx_fn_set_updated_at();
create trigger obx_trg_set_updated_at before update on public.obx_rdos
for each row execute function public.obx_fn_set_updated_at();
create trigger obx_trg_set_updated_at before update on public.obx_custos
for each row execute function public.obx_fn_set_updated_at();

create function public.obx_fn_handle_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.obx_usuarios (id, nome, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nome', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário'
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger obx_trg_novo_usuario
after insert on auth.users
for each row execute function public.obx_fn_handle_novo_usuario();

create function public.obx_fn_perfil_na_empresa(p_empresa_id uuid)
returns public.obx_perfil
language sql
stable
security definer
set search_path = ''
as $$
  select em.perfil
  from public.obx_empresa_membros as em
  where em.empresa_id = p_empresa_id
    and em.usuario_id = auth.uid()
  limit 1
$$;

create function public.obx_fn_usuario_na_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obx_empresa_membros as em
    where em.empresa_id = p_empresa_id
      and em.usuario_id = auth.uid()
  )
$$;

create function public.obx_fn_pode_ver_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obx_obras as o
    join public.obx_empresa_membros as em on em.empresa_id = o.empresa_id
    where o.id = p_obra_id
      and em.usuario_id = auth.uid()
      and (
        em.perfil in ('diretor', 'financeiro')
        or exists (
          select 1
          from public.obx_obra_membros as om
          where om.obra_id = o.id
            and om.usuario_id = auth.uid()
        )
      )
  )
$$;

create function public.obx_fn_pode_editar_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obx_obras as o
    join public.obx_empresa_membros as em on em.empresa_id = o.empresa_id
    where o.id = p_obra_id
      and em.usuario_id = auth.uid()
      and (
        em.perfil = 'diretor'
        or (
          em.perfil = 'engenheiro'
          and exists (
            select 1
            from public.obx_obra_membros as om
            where om.obra_id = o.id
              and om.usuario_id = auth.uid()
          )
        )
      )
  )
$$;

create function public.obx_fn_pode_registrar_campo(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obx_obras as o
    join public.obx_empresa_membros as em on em.empresa_id = o.empresa_id
    where o.id = p_obra_id
      and em.usuario_id = auth.uid()
      and (
        em.perfil = 'diretor'
        or (
          em.perfil in ('engenheiro', 'encarregado')
          and exists (
            select 1
            from public.obx_obra_membros as om
            where om.obra_id = o.id
              and om.usuario_id = auth.uid()
          )
        )
      )
  )
$$;

create function public.obx_fn_pode_editar_custo(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.obx_fn_perfil_na_empresa((
    select o.empresa_id from public.obx_obras as o where o.id = p_obra_id
  )) = 'financeiro'
  or public.obx_fn_pode_editar_obra(p_obra_id)
$$;

create function public.obx_fn_pode_editar_rdo(p_rdo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obx_rdos as r
    where r.id = p_rdo_id
      and public.obx_fn_pode_registrar_campo(r.obra_id)
      and (
        r.status = 'rascunho'
        or public.obx_fn_perfil_na_empresa((
          select o.empresa_id from public.obx_obras as o where o.id = r.obra_id
        )) in ('diretor', 'engenheiro')
      )
  )
$$;

create function public.obx_fn_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antigos jsonb;
  v_novos jsonb;
  v_registro_id uuid;
  v_empresa_id uuid;
  v_obra_id uuid;
  v_rdo_id uuid;
begin
  if tg_op = 'INSERT' then
    v_novos := to_jsonb(new);
    v_registro_id := (v_novos ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_antigos := to_jsonb(old);
    v_novos := to_jsonb(new);
    v_registro_id := (v_novos ->> 'id')::uuid;
  else
    v_antigos := to_jsonb(old);
    v_registro_id := (v_antigos ->> 'id')::uuid;
  end if;

  if tg_table_name = 'obx_obras' then
    v_empresa_id := coalesce((v_novos ->> 'empresa_id')::uuid, (v_antigos ->> 'empresa_id')::uuid);
  elsif tg_table_name = 'obx_rdo_producao' then
    v_rdo_id := coalesce((v_novos ->> 'rdo_id')::uuid, (v_antigos ->> 'rdo_id')::uuid);
    select r.obra_id into v_obra_id from public.obx_rdos as r where r.id = v_rdo_id;
    if v_obra_id is null then
      select e.obra_id into v_obra_id
      from public.obx_eap_itens as e
      where e.id = coalesce((v_novos ->> 'eap_item_id')::uuid, (v_antigos ->> 'eap_item_id')::uuid);
    end if;
  else
    v_obra_id := coalesce((v_novos ->> 'obra_id')::uuid, (v_antigos ->> 'obra_id')::uuid);
  end if;

  if v_empresa_id is null then
    select o.empresa_id into v_empresa_id
    from public.obx_obras as o
    where o.id = v_obra_id;
  end if;

  insert into public.obx_auditoria (tabela, registro_id, empresa_id, acao, dados_antigos, dados_novos, usuario_id)
  values (tg_table_name, v_registro_id, v_empresa_id, tg_op, v_antigos, v_novos, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger obx_trg_auditoria after insert or update or delete on public.obx_obras
for each row execute function public.obx_fn_auditoria();
create trigger obx_trg_auditoria after insert or update or delete on public.obx_eap_itens
for each row execute function public.obx_fn_auditoria();
create trigger obx_trg_auditoria after insert or update or delete on public.obx_rdos
for each row execute function public.obx_fn_auditoria();
create trigger obx_trg_auditoria after insert or update or delete on public.obx_rdo_producao
for each row execute function public.obx_fn_auditoria();
create trigger obx_trg_auditoria after insert or update or delete on public.obx_custos
for each row execute function public.obx_fn_auditoria();

create function public.obx_fn_criar_empresa(p_nome text, p_cnpj text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Autenticação necessária para criar uma empresa';
  end if;

  insert into public.obx_empresas (nome, cnpj)
  values (p_nome, p_cnpj)
  returning id into v_empresa_id;

  insert into public.obx_empresa_membros (empresa_id, usuario_id, perfil)
  values (v_empresa_id, v_usuario_id, 'diretor');

  return v_empresa_id;
end;
$$;

alter table public.obx_empresas enable row level security;
alter table public.obx_usuarios enable row level security;
alter table public.obx_empresa_membros enable row level security;
alter table public.obx_obras enable row level security;
alter table public.obx_obra_membros enable row level security;
alter table public.obx_centros_custo enable row level security;
alter table public.obx_eap_itens enable row level security;
alter table public.obx_rdos enable row level security;
alter table public.obx_rdo_mao_obra enable row level security;
alter table public.obx_rdo_producao enable row level security;
alter table public.obx_rdo_equipamentos enable row level security;
alter table public.obx_rdo_materiais enable row level security;
alter table public.obx_rdo_ocorrencias enable row level security;
alter table public.obx_fotos enable row level security;
alter table public.obx_custos enable row level security;
alter table public.obx_auditoria enable row level security;

create policy obx_empresas_select on public.obx_empresas for select to authenticated
using (public.obx_fn_usuario_na_empresa(id));
create policy obx_empresas_update on public.obx_empresas for update to authenticated
using (public.obx_fn_perfil_na_empresa(id) = 'diretor')
with check (public.obx_fn_perfil_na_empresa(id) = 'diretor');
create policy obx_empresas_delete on public.obx_empresas for delete to authenticated
using (public.obx_fn_perfil_na_empresa(id) = 'diretor');

create policy obx_usuarios_select on public.obx_usuarios for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.obx_empresa_membros as em
    where em.usuario_id = id
      and public.obx_fn_usuario_na_empresa(em.empresa_id)
  )
);
create policy obx_usuarios_insert on public.obx_usuarios for insert to authenticated
with check (id = auth.uid());
create policy obx_usuarios_update on public.obx_usuarios for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy obx_empresa_membros_select on public.obx_empresa_membros for select to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) is not null);
create policy obx_empresa_membros_insert on public.obx_empresa_membros for insert to authenticated
with check (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');
create policy obx_empresa_membros_update on public.obx_empresa_membros for update to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor')
with check (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');
create policy obx_empresa_membros_delete on public.obx_empresa_membros for delete to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');

create policy obx_obras_select on public.obx_obras for select to authenticated
using (public.obx_fn_pode_ver_obra(id));
create policy obx_obras_insert on public.obx_obras for insert to authenticated
with check (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');
create policy obx_obras_update on public.obx_obras for update to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor')
with check (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');
create policy obx_obras_delete on public.obx_obras for delete to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');

create policy obx_obra_membros_select on public.obx_obra_membros for select to authenticated
using (public.obx_fn_pode_ver_obra(obra_id));
create policy obx_obra_membros_insert on public.obx_obra_membros for insert to authenticated
with check (exists (
  select 1
  from public.obx_obras as o
  join public.obx_empresa_membros as em
    on em.empresa_id = o.empresa_id
   and em.usuario_id = obx_obra_membros.usuario_id
  where o.id = obra_id
    and public.obx_fn_perfil_na_empresa(o.empresa_id) = 'diretor'
));
create policy obx_obra_membros_delete on public.obx_obra_membros for delete to authenticated
using (exists (
  select 1 from public.obx_obras as o
  where o.id = obra_id
    and public.obx_fn_perfil_na_empresa(o.empresa_id) = 'diretor'
));

create policy obx_centros_custo_select on public.obx_centros_custo for select to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) is not null);
create policy obx_centros_custo_insert on public.obx_centros_custo for insert to authenticated
with check (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');
create policy obx_centros_custo_update on public.obx_centros_custo for update to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor')
with check (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');
create policy obx_centros_custo_delete on public.obx_centros_custo for delete to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');

create policy obx_eap_itens_select on public.obx_eap_itens for select to authenticated
using (public.obx_fn_pode_ver_obra(obra_id));
create policy obx_eap_itens_insert on public.obx_eap_itens for insert to authenticated
with check (public.obx_fn_pode_editar_obra(obra_id));
create policy obx_eap_itens_update on public.obx_eap_itens for update to authenticated
using (public.obx_fn_pode_editar_obra(obra_id))
with check (public.obx_fn_pode_editar_obra(obra_id));
create policy obx_eap_itens_delete on public.obx_eap_itens for delete to authenticated
using (public.obx_fn_pode_editar_obra(obra_id));

create policy obx_rdos_select on public.obx_rdos for select to authenticated
using (public.obx_fn_pode_ver_obra(obra_id));
create policy obx_rdos_insert on public.obx_rdos for insert to authenticated
with check (
  public.obx_fn_pode_registrar_campo(obra_id)
  and criado_por = auth.uid()
  and (
    status <> 'confirmado'
    or (
      public.obx_fn_perfil_na_empresa((
        select o.empresa_id from public.obx_obras as o where o.id = obra_id
      )) in ('diretor', 'engenheiro')
      and confirmado_por = auth.uid()
    )
  )
);
create policy obx_rdos_update on public.obx_rdos for update to authenticated
using (public.obx_fn_pode_editar_rdo(id))
with check (
  public.obx_fn_pode_editar_rdo(id)
  and public.obx_fn_pode_registrar_campo(obra_id)
  and (
    status <> 'confirmado'
    or (
      public.obx_fn_perfil_na_empresa((
        select o.empresa_id from public.obx_obras as o where o.id = obra_id
      )) in ('diretor', 'engenheiro')
      and confirmado_por = auth.uid()
    )
  )
);
create policy obx_rdos_delete on public.obx_rdos for delete to authenticated
using (status = 'rascunho' and public.obx_fn_pode_registrar_campo(obra_id));

create policy obx_rdo_mao_obra_select on public.obx_rdo_mao_obra for select to authenticated
using (exists (
  select 1 from public.obx_rdos as r
  where r.id = rdo_id and public.obx_fn_pode_ver_obra(r.obra_id)
));
create policy obx_rdo_mao_obra_insert on public.obx_rdo_mao_obra for insert to authenticated
with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_mao_obra_update on public.obx_rdo_mao_obra for update to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id)) with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_mao_obra_delete on public.obx_rdo_mao_obra for delete to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id));

create policy obx_rdo_producao_select on public.obx_rdo_producao for select to authenticated
using (exists (
  select 1 from public.obx_rdos as r
  where r.id = rdo_id and public.obx_fn_pode_ver_obra(r.obra_id)
));
create policy obx_rdo_producao_insert on public.obx_rdo_producao for insert to authenticated
with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_producao_update on public.obx_rdo_producao for update to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id)) with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_producao_delete on public.obx_rdo_producao for delete to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id));

create policy obx_rdo_equipamentos_select on public.obx_rdo_equipamentos for select to authenticated
using (exists (
  select 1 from public.obx_rdos as r
  where r.id = rdo_id and public.obx_fn_pode_ver_obra(r.obra_id)
));
create policy obx_rdo_equipamentos_insert on public.obx_rdo_equipamentos for insert to authenticated
with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_equipamentos_update on public.obx_rdo_equipamentos for update to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id)) with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_equipamentos_delete on public.obx_rdo_equipamentos for delete to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id));

create policy obx_rdo_materiais_select on public.obx_rdo_materiais for select to authenticated
using (exists (
  select 1 from public.obx_rdos as r
  where r.id = rdo_id and public.obx_fn_pode_ver_obra(r.obra_id)
));
create policy obx_rdo_materiais_insert on public.obx_rdo_materiais for insert to authenticated
with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_materiais_update on public.obx_rdo_materiais for update to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id)) with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_materiais_delete on public.obx_rdo_materiais for delete to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id));

create policy obx_rdo_ocorrencias_select on public.obx_rdo_ocorrencias for select to authenticated
using (exists (
  select 1 from public.obx_rdos as r
  where r.id = rdo_id and public.obx_fn_pode_ver_obra(r.obra_id)
));
create policy obx_rdo_ocorrencias_insert on public.obx_rdo_ocorrencias for insert to authenticated
with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_ocorrencias_update on public.obx_rdo_ocorrencias for update to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id)) with check (public.obx_fn_pode_editar_rdo(rdo_id));
create policy obx_rdo_ocorrencias_delete on public.obx_rdo_ocorrencias for delete to authenticated
using (public.obx_fn_pode_editar_rdo(rdo_id));

create policy obx_fotos_select on public.obx_fotos for select to authenticated
using (public.obx_fn_pode_ver_obra(obra_id));
create policy obx_fotos_insert on public.obx_fotos for insert to authenticated
with check (public.obx_fn_pode_registrar_campo(obra_id) and criado_por = auth.uid());
create policy obx_fotos_update on public.obx_fotos for update to authenticated
using (public.obx_fn_pode_registrar_campo(obra_id))
with check (public.obx_fn_pode_registrar_campo(obra_id));
create policy obx_fotos_delete on public.obx_fotos for delete to authenticated
using (public.obx_fn_pode_registrar_campo(obra_id));

create policy obx_custos_select on public.obx_custos for select to authenticated
using (public.obx_fn_pode_ver_obra(obra_id));
create policy obx_custos_insert on public.obx_custos for insert to authenticated
with check (public.obx_fn_pode_editar_custo(obra_id) and criado_por = auth.uid());
create policy obx_custos_update on public.obx_custos for update to authenticated
using (public.obx_fn_pode_editar_custo(obra_id))
with check (public.obx_fn_pode_editar_custo(obra_id));
create policy obx_custos_delete on public.obx_custos for delete to authenticated
using (public.obx_fn_pode_editar_custo(obra_id));

create policy obx_auditoria_select on public.obx_auditoria for select to authenticated
using (public.obx_fn_perfil_na_empresa(empresa_id) = 'diretor');

grant select, insert, update, delete on public.obx_empresas to authenticated;
grant select, insert, update, delete on public.obx_usuarios to authenticated;
grant select, insert, update, delete on public.obx_empresa_membros to authenticated;
grant select, insert, update, delete on public.obx_obras to authenticated;
grant select, insert, update, delete on public.obx_obra_membros to authenticated;
grant select, insert, update, delete on public.obx_centros_custo to authenticated;
grant select, insert, update, delete on public.obx_eap_itens to authenticated;
grant select, insert, update, delete on public.obx_rdos to authenticated;
grant select, insert, update, delete on public.obx_rdo_mao_obra to authenticated;
grant select, insert, update, delete on public.obx_rdo_producao to authenticated;
grant select, insert, update, delete on public.obx_rdo_equipamentos to authenticated;
grant select, insert, update, delete on public.obx_rdo_materiais to authenticated;
grant select, insert, update, delete on public.obx_rdo_ocorrencias to authenticated;
grant select, insert, update, delete on public.obx_fotos to authenticated;
grant select, insert, update, delete on public.obx_custos to authenticated;
revoke insert, update, delete, truncate, references, trigger
on public.obx_auditoria from anon, authenticated, service_role;
grant select on public.obx_auditoria to authenticated;

grant execute on function public.obx_fn_perfil_na_empresa(uuid) to authenticated;
grant execute on function public.obx_fn_usuario_na_empresa(uuid) to authenticated;
grant execute on function public.obx_fn_pode_ver_obra(uuid) to authenticated;
grant execute on function public.obx_fn_pode_editar_obra(uuid) to authenticated;
grant execute on function public.obx_fn_pode_registrar_campo(uuid) to authenticated;
grant execute on function public.obx_fn_pode_editar_custo(uuid) to authenticated;
grant execute on function public.obx_fn_pode_editar_rdo(uuid) to authenticated;
grant execute on function public.obx_fn_criar_empresa(text, text) to authenticated;

create view public.obx_vw_obra_resumo
with (security_invoker = true)
as
with producao as (
  select
    e.obra_id,
    p.eap_item_id,
    sum(p.quantidade) as quantidade_executada
  from public.obx_rdo_producao as p
  join public.obx_rdos as r on r.id = p.rdo_id and r.status = 'confirmado'
  join public.obx_eap_itens as e on e.id = p.eap_item_id
  group by e.obra_id, p.eap_item_id
),
orcamento as (
  select e.obra_id, sum(e.custo_total) as orcado_total
  from public.obx_eap_itens as e
  where e.tipo = 'servico'
  group by e.obra_id
),
executado as (
  select
    e.obra_id,
    sum(least(coalesce(p.quantidade_executada, 0), e.quantidade) * e.custo_unitario) as valor_executado
  from public.obx_eap_itens as e
  left join producao as p on p.eap_item_id = e.id and p.obra_id = e.obra_id
  where e.tipo = 'servico'
  group by e.obra_id
),
realizado as (
  select c.obra_id, sum(c.valor) as custo_realizado
  from public.obx_custos as c
  group by c.obra_id
)
select
  o.id as obra_id,
  coalesce(orc.orcado_total, 0)::numeric(14,2) as orcado_total,
  coalesce(real.custo_realizado, 0)::numeric(14,2) as custo_realizado,
  coalesce(exec.valor_executado, 0)::numeric(14,2) as valor_executado,
  case
    when coalesce(orc.orcado_total, 0) = 0 then 0
    else least(1, greatest(0, coalesce(exec.valor_executado, 0) / orc.orcado_total)) * 100
  end::numeric(7,2) as avanco_fisico_pct,
  case
    when o.data_inicio is null or o.data_fim_prevista is null or o.data_fim_prevista <= o.data_inicio then 0
    else least(1, greatest(0,
      (current_date - o.data_inicio)::numeric
      / nullif((o.data_fim_prevista - o.data_inicio)::numeric, 0)
    )) * 100
  end::numeric(7,2) as avanco_planejado_pct
from public.obx_obras as o
left join orcamento as orc on orc.obra_id = o.id
left join realizado as real on real.obra_id = o.id
left join executado as exec on exec.obra_id = o.id;

grant select on public.obx_vw_obra_resumo to authenticated;

insert into storage.buckets (id, name, public)
values ('obx_fotos', 'obx_fotos', false)
on conflict (id) do nothing;

create policy obx_storage_fotos_select on storage.objects for select to authenticated
using (
  bucket_id = 'obx_fotos'
  and case
    when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.+$'
      then public.obx_fn_pode_ver_obra(split_part(name, '/', 1)::uuid)
    else false
  end
);
create policy obx_storage_fotos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'obx_fotos'
  and case
    when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.+$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
    else false
  end
);
create policy obx_storage_fotos_update on storage.objects for update to authenticated
using (
  bucket_id = 'obx_fotos'
  and case
    when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.+$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
    else false
  end
)
with check (
  bucket_id = 'obx_fotos'
  and case
    when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.+$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
    else false
  end
);
create policy obx_storage_fotos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'obx_fotos'
  and case
    when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.+$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
    else false
  end
);
