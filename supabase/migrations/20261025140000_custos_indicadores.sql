alter table public.obx_custos
  add constraint obx_custos_valor_positivo check (valor > 0);

create function public.obx_fn_custos_valida()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item record;
  v_empresa_id uuid;
begin
  if new.eap_item_id is not null then
    select e.centro_custo_id
    into v_item
    from public.obx_eap_itens as e
    where e.id = new.eap_item_id
      and e.obra_id = new.obra_id
      and e.tipo = 'servico';

    if not found then
      raise exception 'O serviço EAP precisa ser um serviço da mesma obra.'
        using errcode = '23514';
    end if;

    if new.centro_custo_id is null then
      new.centro_custo_id := v_item.centro_custo_id;
    end if;
  end if;

  if new.centro_custo_id is not null then
    select o.empresa_id
    into v_empresa_id
    from public.obx_centros_custo as c
    join public.obx_obras as o on o.empresa_id = c.empresa_id
    where c.id = new.centro_custo_id
      and o.id = new.obra_id;

    if not found then
      raise exception 'O centro de custo precisa pertencer à empresa da obra.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.obx_fn_custos_valida() from public;
create trigger obx_trg_custos_valida
before insert or update on public.obx_custos
for each row execute function public.obx_fn_custos_valida();

create function public.obx_fn_importar_custos(
  p_obra_id uuid,
  p_itens jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_work record;
  v_item jsonb;
  v_data date;
  v_categoria public.obx_custo_categoria;
  v_valor numeric(14,2);
  v_descricao text;
  v_fornecedor text;
  v_documento text;
  v_codigo_eap text;
  v_eap_item_id uuid;
  v_codigo_centro text;
  v_centro_custo_id uuid;
  v_inseridos integer := 0;
  v_index integer := 0;
begin
  if not coalesce(public.obx_fn_pode_editar_custo(p_obra_id), false) then
    raise exception 'Você não tem permissão para lançar custos nesta obra.'
      using errcode = '42501';
  end if;

  select o.empresa_id, e.fuso_horario
  into v_work
  from public.obx_obras as o
  join public.obx_empresas as e on e.id = o.empresa_id
  where o.id = p_obra_id;
  if not found then
    raise exception 'Obra não encontrada.' using errcode = 'P0002';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) is distinct from 'array' then
    raise exception 'A importação deve ser uma lista de custos.'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 5000 then
    raise exception 'A importação deve conter entre 1 e 5.000 custos.'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_index := v_index + 1;
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'Item inválido na linha %.', v_index
        using errcode = '22023';
    end if;

    v_descricao := nullif(btrim(v_item ->> 'descricao'), '');
    v_fornecedor := nullif(btrim(v_item ->> 'fornecedor'), '');
    v_documento := nullif(btrim(v_item ->> 'documento'), '');
    v_codigo_eap := nullif(btrim(v_item ->> 'codigo_eap'), '');
    v_codigo_centro := nullif(btrim(v_item ->> 'centro_custo'), '');
    v_eap_item_id := null;
    v_centro_custo_id := null;

    begin
      v_data := nullif(v_item ->> 'data', '')::date;
      v_categoria := (v_item ->> 'categoria')::public.obx_custo_categoria;
      v_valor := nullif(v_item ->> 'valor', '')::numeric(14,2);
    exception
      when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
        raise exception 'Data, categoria ou valor inválido na linha %.', v_index
          using errcode = '22023';
    end;

    if v_data is null or v_categoria is null or v_descricao is null
      or v_valor is null or v_valor <= 0
    then
      raise exception 'Data, descrição, categoria e valor positivo são obrigatórios na linha %.', v_index
        using errcode = '22023';
    end if;
    if v_data > (now() at time zone v_work.fuso_horario)::date then
      raise exception 'Não é possível importar um custo em data futura (linha %).', v_index
        using errcode = '22023';
    end if;

    if v_codigo_eap is not null then
      select e.id
      into v_eap_item_id
      from public.obx_eap_itens as e
      where e.obra_id = p_obra_id
        and e.codigo = v_codigo_eap
        and e.tipo = 'servico';
      if not found then
        raise exception 'Serviço EAP inválido na linha %: %.', v_index, v_codigo_eap
          using errcode = '23503';
      end if;
    end if;

    if v_codigo_centro is not null then
      select c.id
      into v_centro_custo_id
      from public.obx_centros_custo as c
      where c.empresa_id = v_work.empresa_id
        and upper(c.codigo) = upper(v_codigo_centro);
      if not found then
        raise exception 'Centro de custo inválido na linha %: %.', v_index, v_codigo_centro
          using errcode = '23503';
      end if;
    end if;

    insert into public.obx_custos (
      obra_id,
      eap_item_id,
      centro_custo_id,
      categoria,
      descricao,
      fornecedor,
      documento,
      data,
      valor,
      criado_por
    )
    values (
      p_obra_id,
      v_eap_item_id,
      v_centro_custo_id,
      v_categoria,
      v_descricao,
      v_fornecedor,
      v_documento,
      v_data,
      v_valor,
      auth.uid()
    );
    v_inseridos := v_inseridos + 1;
  end loop;

  return jsonb_build_object('inseridos', v_inseridos);
end;
$$;

revoke all on function public.obx_fn_importar_custos(uuid, jsonb) from public;
grant execute on function public.obx_fn_importar_custos(uuid, jsonb) to authenticated;
