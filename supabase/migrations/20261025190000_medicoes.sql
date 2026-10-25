-- Boletins de medição por período

create table public.obx_medicoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obx_obras(id) on delete cascade,
  numero integer not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  criada_por uuid references public.obx_usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (obra_id, numero),
  constraint obx_medicao_periodo_valido check (periodo_fim >= periodo_inicio)
);

create table public.obx_medicao_itens (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references public.obx_medicoes(id) on delete cascade,
  eap_item_id uuid not null references public.obx_eap_itens(id) on delete cascade,
  quantidade numeric(14,4) not null,
  valor numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (medicao_id, eap_item_id),
  constraint obx_medicao_item_valores check (quantidade > 0 and valor >= 0)
);

create index obx_medicoes_obra_idx on public.obx_medicoes (obra_id, numero desc);
create index obx_medicao_itens_medicao_idx on public.obx_medicao_itens (medicao_id);
create index obx_medicao_itens_eap_idx on public.obx_medicao_itens (eap_item_id);

alter table public.obx_medicoes enable row level security;
alter table public.obx_medicao_itens enable row level security;

create policy obx_medicoes_select on public.obx_medicoes for select to authenticated
using (public.obx_fn_pode_ver_obra(obra_id));
create policy obx_medicoes_insert on public.obx_medicoes for insert to authenticated
with check (public.obx_fn_pode_editar_obra(obra_id));
create policy obx_medicoes_delete on public.obx_medicoes for delete to authenticated
using (public.obx_fn_pode_editar_obra(obra_id));

create policy obx_medicao_itens_select on public.obx_medicao_itens for select to authenticated
using (
  exists (
    select 1
    from public.obx_medicoes as m
    where m.id = medicao_id
      and public.obx_fn_pode_ver_obra(m.obra_id)
  )
);
create policy obx_medicao_itens_insert on public.obx_medicao_itens for insert to authenticated
with check (
  exists (
    select 1
    from public.obx_medicoes as m
    where m.id = medicao_id
      and public.obx_fn_pode_editar_obra(m.obra_id)
  )
);
create policy obx_medicao_itens_delete on public.obx_medicao_itens for delete to authenticated
using (
  exists (
    select 1
    from public.obx_medicoes as m
    where m.id = medicao_id
      and public.obx_fn_pode_editar_obra(m.obra_id)
  )
);

-- Emite o boletim de medição do período: soma a produção confirmada em RDO
-- por serviço da EAP e gera o snapshot numerado por obra.
create function public.obx_fn_emitir_medicao(
  p_obra_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_medicao_id uuid;
  v_numero integer;
begin
  if not public.obx_fn_pode_editar_obra(p_obra_id) then
    raise exception 'Você não tem permissão para emitir medição nesta obra.'
      using errcode = '42501';
  end if;

  if p_periodo_fim < p_periodo_inicio then
    raise exception 'O fim do período não pode ser antes do início.'
      using errcode = '22023';
  end if;

  select coalesce(max(m.numero), 0) + 1
    into v_numero
  from public.obx_medicoes as m
  where m.obra_id = p_obra_id;

  insert into public.obx_medicoes (
    obra_id,
    numero,
    periodo_inicio,
    periodo_fim,
    criada_por
  ) values (
    p_obra_id,
    v_numero,
    p_periodo_inicio,
    p_periodo_fim,
    (select auth.uid())
  ) returning id into v_medicao_id;

  insert into public.obx_medicao_itens (
    medicao_id,
    eap_item_id,
    quantidade,
    valor
  )
  select
    v_medicao_id,
    p.eap_item_id,
    sum(p.quantidade),
    round(sum(p.quantidade) * s.custo_unitario, 2)
  from public.obx_rdo_producao as p
  join public.obx_rdos as r
    on r.id = p.rdo_id
    and r.status = 'confirmado'
    and r.data >= p_periodo_inicio
    and r.data <= p_periodo_fim
  join public.obx_eap_itens as s
    on s.id = p.eap_item_id
    and s.obra_id = p_obra_id
  group by p.eap_item_id, s.custo_unitario
  having sum(p.quantidade) > 0;

  return v_medicao_id;
end;
$$;

revoke all on function
  public.obx_fn_emitir_medicao(uuid, date, date)
from public;

grant execute on function
  public.obx_fn_emitir_medicao(uuid, date, date)
to authenticated;
