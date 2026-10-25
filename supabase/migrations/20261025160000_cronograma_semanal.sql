-- Cronograma por EAP e planejamento semanal (PPC)

alter table public.obx_eap_itens
  add column inicio_previsto date,
  add column fim_previsto date,
  add constraint obx_eap_datas_validas
    check (inicio_previsto is null or fim_previsto is null or fim_previsto >= inicio_previsto);

create type public.obx_plano_status as enum ('aberto', 'fechado');

create table public.obx_planos_semanais (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obx_obras(id) on delete cascade,
  semana_inicio date not null,
  status public.obx_plano_status not null default 'aberto',
  criado_por uuid references public.obx_usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obra_id, semana_inicio),
  constraint obx_plano_semana_segunda check (extract(isodow from semana_inicio) = 1)
);

create table public.obx_plano_semanal_itens (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.obx_planos_semanais(id) on delete cascade,
  eap_item_id uuid not null references public.obx_eap_itens(id) on delete cascade,
  quantidade_planejada numeric(14,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, eap_item_id),
  constraint obx_plano_item_qtd_positiva check (quantidade_planejada > 0)
);

create index obx_planos_obra_idx on public.obx_planos_semanais (obra_id, semana_inicio desc);
create index obx_plano_itens_plano_idx on public.obx_plano_semanal_itens (plano_id);
create index obx_plano_itens_eap_idx on public.obx_plano_semanal_itens (eap_item_id);

create trigger obx_trg_set_updated_at before update on public.obx_planos_semanais
for each row execute function public.obx_fn_set_updated_at();

create trigger obx_trg_set_updated_at before update on public.obx_plano_semanal_itens
for each row execute function public.obx_fn_set_updated_at();

alter table public.obx_planos_semanais enable row level security;
alter table public.obx_plano_semanal_itens enable row level security;

create policy obx_planos_select on public.obx_planos_semanais for select to authenticated
using (public.obx_fn_pode_ver_obra(obra_id));
create policy obx_planos_insert on public.obx_planos_semanais for insert to authenticated
with check (public.obx_fn_pode_editar_obra(obra_id));
create policy obx_planos_update on public.obx_planos_semanais for update to authenticated
using (public.obx_fn_pode_editar_obra(obra_id))
with check (public.obx_fn_pode_editar_obra(obra_id));
create policy obx_planos_delete on public.obx_planos_semanais for delete to authenticated
using (public.obx_fn_pode_editar_obra(obra_id));

create policy obx_plano_itens_select on public.obx_plano_semanal_itens for select to authenticated
using (
  exists (
    select 1 from public.obx_planos_semanais as p
    where p.id = plano_id and public.obx_fn_pode_ver_obra(p.obra_id)
  )
);
create policy obx_plano_itens_insert on public.obx_plano_semanal_itens for insert to authenticated
with check (
  exists (
    select 1 from public.obx_planos_semanais as p
    where p.id = plano_id and public.obx_fn_pode_editar_obra(p.obra_id)
  )
);
create policy obx_plano_itens_update on public.obx_plano_semanal_itens for update to authenticated
using (
  exists (
    select 1 from public.obx_planos_semanais as p
    where p.id = plano_id and public.obx_fn_pode_editar_obra(p.obra_id)
  )
)
with check (
  exists (
    select 1 from public.obx_planos_semanais as p
    where p.id = plano_id and public.obx_fn_pode_editar_obra(p.obra_id)
  )
);
create policy obx_plano_itens_delete on public.obx_plano_semanal_itens for delete to authenticated
using (
  exists (
    select 1 from public.obx_planos_semanais as p
    where p.id = plano_id and public.obx_fn_pode_editar_obra(p.obra_id)
  )
);

-- Valida que o item planejado é um serviço da obra do plano
create function public.obx_fn_plano_item_valida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.obx_planos_semanais as p
    join public.obx_eap_itens as e on e.obra_id = p.obra_id
    where p.id = new.plano_id
      and e.id = new.eap_item_id
      and e.tipo = 'servico'
  ) then
    raise exception 'O item planejado precisa ser um serviço da mesma obra do plano.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.obx_fn_plano_item_valida() from public;
create trigger obx_trg_plano_item_valida
before insert or update on public.obx_plano_semanal_itens
for each row execute function public.obx_fn_plano_item_valida();

-- Salva (upsert) um plano semanal com seus itens de forma atômica.
-- p_itens: jsonb array de {"eap_item_id": uuid, "quantidade_planejada": number}
create function public.obx_fn_salvar_plano_semanal(
  p_obra_id uuid,
  p_semana_inicio date,
  p_itens jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plano_id uuid;
  v_item jsonb;
  v_index integer := 0;
begin
  if not coalesce(public.obx_fn_pode_editar_obra(p_obra_id), false) then
    raise exception 'Você não tem permissão para editar o planejamento desta obra.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.obx_obras where id = p_obra_id) then
    raise exception 'Obra não encontrada.' using errcode = 'P0002';
  end if;

  if extract(isodow from p_semana_inicio) <> 1 then
    raise exception 'A semana deve começar numa segunda-feira.'
      using errcode = '22023';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) is distinct from 'array' then
    raise exception 'O plano deve ser uma lista de itens.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) > 500 then
    raise exception 'O plano deve conter no máximo 500 itens.' using errcode = '22023';
  end if;

  insert into public.obx_planos_semanais (obra_id, semana_inicio, criado_por)
  values (p_obra_id, p_semana_inicio, auth.uid())
  on conflict (obra_id, semana_inicio) do update set updated_at = now()
  returning id into v_plano_id;

  delete from public.obx_plano_semanal_itens where plano_id = v_plano_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_index := v_index + 1;
    if jsonb_typeof(v_item) is distinct from 'object'
       or nullif(v_item ->> 'eap_item_id', '') is null
       or (v_item ->> 'quantidade_planejada')::numeric <= 0 then
      raise exception 'Item inválido na linha %.', v_index using errcode = '22023';
    end if;

    insert into public.obx_plano_semanal_itens (plano_id, eap_item_id, quantidade_planejada)
    values (v_plano_id, (v_item ->> 'eap_item_id')::uuid, (v_item ->> 'quantidade_planejada')::numeric);
  end loop;

  return v_plano_id;
end;
$$;
