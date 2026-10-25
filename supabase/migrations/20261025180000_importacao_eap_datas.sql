create or replace function public.obx_fn_importar_eap(
  p_obra_id uuid,
  p_itens jsonb,
  p_modo text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item record;
  v_payload jsonb;
  v_codigo text;
  v_descricao text;
  v_tipo public.obx_eap_tipo;
  v_unidade text;
  v_quantidade numeric;
  v_custo_unitario numeric;
  v_centro_custo_id uuid;
  v_inicio_previsto date;
  v_fim_previsto date;
  v_parent_codigo text;
  v_parent_id uuid;
  v_item_id uuid;
  v_ordem integer;
  v_inseridos integer := 0;
  v_atualizados integer := 0;
  v_excluidos integer := 0;
begin
  if not public.obx_fn_pode_editar_obra(p_obra_id) then
    raise exception 'Sem permissão para editar a EAP desta obra.'
      using errcode = '42501';
  end if;

  if p_modo is distinct from 'substituir'
    and p_modo is distinct from 'mesclar'
  then
    raise exception 'Modo de importação inválido.' using errcode = '22023';
  end if;

  if p_itens is null
    or jsonb_typeof(p_itens) is distinct from 'array'
  then
    raise exception 'A importação deve ser uma lista de itens.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 5000 then
    raise exception 'A importação deve conter entre 1 e 5.000 itens.'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_itens) as item(value)
    where jsonb_typeof(value) is distinct from 'object'
  ) then
    raise exception 'Cada item da importação deve ser um objeto.'
      using errcode = '22023';
  end if;
  if exists (
    select nullif(btrim(value ->> 'codigo'), '')
    from jsonb_array_elements(p_itens) as item(value)
    where nullif(btrim(value ->> 'codigo'), '') is not null
    group by nullif(btrim(value ->> 'codigo'), '')
    having count(*) > 1
  ) then
    raise exception 'A importação contém códigos duplicados.'
      using errcode = '22023';
  end if;

  if p_modo = 'substituir' then
    if exists (
      select 1
      from public.obx_eap_itens as e
      join public.obx_rdo_producao as p on p.eap_item_id = e.id
      where e.obra_id = p_obra_id
    ) then
      raise exception 'Não é possível substituir uma EAP com produção registrada.'
        using errcode = '23514';
    end if;

    select count(*)::integer
    into v_excluidos
    from public.obx_eap_itens
    where obra_id = p_obra_id;

    delete from public.obx_eap_itens
    where obra_id = p_obra_id;
  end if;

  for v_item in
    select value as payload, ordinality::integer as ordem
    from jsonb_array_elements(p_itens) with ordinality
    order by ordinality
  loop
    v_payload := v_item.payload;
    v_ordem := v_item.ordem;
    v_codigo := nullif(btrim(v_payload ->> 'codigo'), '');
    v_descricao := nullif(btrim(v_payload ->> 'descricao'), '');
    v_unidade := nullif(btrim(v_payload ->> 'unidade'), '');

    if jsonb_typeof(v_payload) is distinct from 'object'
      or v_codigo is null
      or v_codigo !~ '^\d+(\.\d+)*$'
      or v_descricao is null
    then
      raise exception 'Item inválido na posição %.', v_ordem
        using errcode = '22023';
    end if;

    begin
      v_tipo := (v_payload ->> 'tipo')::public.obx_eap_tipo;
      v_quantidade := coalesce(nullif(v_payload ->> 'quantidade', '')::numeric, 0);
      v_custo_unitario := coalesce(nullif(v_payload ->> 'custo_unitario', '')::numeric, 0);
      v_centro_custo_id := nullif(v_payload ->> 'centro_custo_id', '')::uuid;
      v_inicio_previsto := nullif(v_payload ->> 'inicio_previsto', '')::date;
      v_fim_previsto := nullif(v_payload ->> 'fim_previsto', '')::date;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Valores inválidos no item %.', v_ordem
          using errcode = '22023';
    end;

    if v_inicio_previsto is not null
      and v_fim_previsto is not null
      and v_fim_previsto < v_inicio_previsto
    then
      raise exception 'Fim previsto anterior ao início no item %.', v_ordem
        using errcode = '22023';
    end if;

    if v_quantidade < 0 or v_custo_unitario < 0 then
      raise exception 'Quantidade e custo não podem ser negativos no item %.', v_ordem
        using errcode = '22023';
    end if;
    if v_tipo = 'servico' and (v_unidade is null or v_quantidade <= 0) then
      raise exception 'Serviço precisa de unidade e quantidade maior que zero no item %.', v_ordem
        using errcode = '22023';
    end if;

    if v_centro_custo_id is not null and not exists (
      select 1
      from public.obx_centros_custo as c
      join public.obx_obras as o on o.empresa_id = c.empresa_id
      where c.id = v_centro_custo_id
        and o.id = p_obra_id
    ) then
      raise exception 'Centro de custo inválido no item %.', v_ordem
        using errcode = '22023';
    end if;

    v_parent_codigo := case
      when position('.' in v_codigo) = 0 then null
      else regexp_replace(v_codigo, '\.[^.]+$', '')
    end;
    v_parent_id := null;
    if v_parent_codigo is not null then
      select id
      into v_parent_id
      from public.obx_eap_itens
      where obra_id = p_obra_id
        and codigo = v_parent_codigo;

      if v_parent_id is null then
        raise exception 'Etapa pai % não encontrada para o item %.',
          v_parent_codigo, v_codigo
          using errcode = '23503';
      end if;
    end if;

    if p_modo = 'mesclar' then
      update public.obx_eap_itens
      set
        parent_id = v_parent_id,
        descricao = v_descricao,
        tipo = v_tipo,
        unidade = v_unidade,
        quantidade = v_quantidade,
        custo_unitario = v_custo_unitario,
        centro_custo_id = v_centro_custo_id,
        inicio_previsto = coalesce(v_inicio_previsto, inicio_previsto),
        fim_previsto = coalesce(v_fim_previsto, fim_previsto),
        ordem = v_ordem
      where obra_id = p_obra_id
        and codigo = v_codigo
      returning id into v_item_id;
    end if;

    if p_modo = 'substituir' or not found then
      insert into public.obx_eap_itens (
        obra_id,
        parent_id,
        codigo,
        descricao,
        tipo,
        unidade,
        quantidade,
        custo_unitario,
        centro_custo_id,
        inicio_previsto,
        fim_previsto,
        ordem
      )
      values (
        p_obra_id,
        v_parent_id,
        v_codigo,
        v_descricao,
        v_tipo,
        v_unidade,
        v_quantidade,
        v_custo_unitario,
        v_centro_custo_id,
        v_inicio_previsto,
        v_fim_previsto,
        v_ordem
      )
      returning id into v_item_id;
      v_inseridos := v_inseridos + 1;
    else
      v_atualizados := v_atualizados + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'excluidos', v_excluidos
  );
end;
$$;

revoke all on function public.obx_fn_importar_eap(uuid, jsonb, text) from public;
grant execute on function public.obx_fn_importar_eap(uuid, jsonb, text) to authenticated;
