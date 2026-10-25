create function public.obx_fn_salvar_rdo(
  p_obra_id uuid,
  p_data date,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rdo_id uuid;
  v_existing_id uuid;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para salvar o RDO.';
  end if;
  if p_data > current_date then
    raise exception 'Não é possível registrar um RDO em uma data futura.';
  end if;
  if not public.obx_fn_pode_registrar_campo(p_obra_id) then
    raise exception 'Você não tem permissão para registrar campo nesta obra.';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Os dados do RDO são inválidos.';
  end if;
  if jsonb_typeof(coalesce(p_payload->'mao_obra', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_payload->'producao', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_payload->'equipamentos', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_payload->'materiais', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_payload->'ocorrencias', '[]'::jsonb)) is distinct from 'array'
  then
    raise exception 'As listas do RDO são inválidas.';
  end if;

  select r.id into v_existing_id
  from public.obx_rdos as r
  where r.obra_id = p_obra_id and r.data = p_data;

  if v_existing_id is not null
    and not public.obx_fn_pode_editar_rdo(v_existing_id)
  then
    raise exception 'Este RDO está confirmado e não pode ser alterado pelo seu perfil.';
  end if;

  insert into public.obx_rdos (
    obra_id, data, clima_manha, clima_tarde, observacoes, criado_por
  )
  values (
    p_obra_id,
    p_data,
    nullif(p_payload->>'clima_manha', '')::public.obx_clima,
    nullif(p_payload->>'clima_tarde', '')::public.obx_clima,
    nullif(p_payload->>'observacoes', ''),
    auth.uid()
  )
  on conflict (obra_id, data) do update
  set clima_manha = excluded.clima_manha,
      clima_tarde = excluded.clima_tarde,
      observacoes = excluded.observacoes,
      updated_at = now()
  where public.obx_fn_pode_editar_rdo(public.obx_rdos.id)
  returning id into v_rdo_id;

  if v_rdo_id is null then
    raise exception 'Não foi possível salvar o RDO. Verifique suas permissões.';
  end if;

  delete from public.obx_rdo_mao_obra where rdo_id = v_rdo_id;
  delete from public.obx_rdo_producao where rdo_id = v_rdo_id;
  delete from public.obx_rdo_equipamentos where rdo_id = v_rdo_id;
  delete from public.obx_rdo_materiais where rdo_id = v_rdo_id;
  delete from public.obx_rdo_ocorrencias where rdo_id = v_rdo_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'mao_obra', '[]'::jsonb)) as value
  loop
    insert into public.obx_rdo_mao_obra (rdo_id, funcao, quantidade, horas)
    values (v_rdo_id, v_item->>'funcao', (v_item->>'quantidade')::integer, (v_item->>'horas')::numeric);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'producao', '[]'::jsonb)) as value
  loop
    if not exists (
      select 1 from public.obx_eap_itens as e
      where e.id = (v_item->>'eap_item_id')::uuid
        and e.obra_id = p_obra_id
        and e.tipo = 'servico'
    ) then
      raise exception 'O serviço selecionado não pertence a esta obra.';
    end if;
    insert into public.obx_rdo_producao (rdo_id, eap_item_id, quantidade, observacao)
    values (v_rdo_id, (v_item->>'eap_item_id')::uuid, (v_item->>'quantidade')::numeric, nullif(v_item->>'observacao', ''));
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'equipamentos', '[]'::jsonb)) as value
  loop
    insert into public.obx_rdo_equipamentos (rdo_id, equipamento, horas_trabalhadas, horas_paradas, motivo_parada)
    values (
      v_rdo_id,
      v_item->>'equipamento',
      (v_item->>'horas_trabalhadas')::numeric,
      (v_item->>'horas_paradas')::numeric,
      nullif(v_item->>'motivo_parada', '')
    );
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'materiais', '[]'::jsonb)) as value
  loop
    insert into public.obx_rdo_materiais (rdo_id, material, quantidade, unidade)
    values (v_rdo_id, v_item->>'material', (v_item->>'quantidade')::numeric, v_item->>'unidade');
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'ocorrencias', '[]'::jsonb)) as value
  loop
    insert into public.obx_rdo_ocorrencias (rdo_id, tipo, descricao, hora_inicio, hora_fim)
    values (
      v_rdo_id,
      v_item->>'tipo',
      v_item->>'descricao',
      nullif(v_item->>'hora_inicio', '')::time,
      nullif(v_item->>'hora_fim', '')::time
    );
  end loop;

  return v_rdo_id;
end;
$$;

grant execute on function public.obx_fn_salvar_rdo(uuid, date, jsonb) to authenticated;

drop policy obx_fotos_insert on public.obx_fotos;
create policy obx_fotos_insert on public.obx_fotos for insert to authenticated
with check (
  public.obx_fn_pode_registrar_campo(obra_id)
  and criado_por = auth.uid()
  and (
    rdo_id is null
    or exists (
      select 1 from public.obx_rdos as r
      where r.id = obx_fotos.rdo_id
        and r.obra_id = obx_fotos.obra_id
        and r.status = 'rascunho'
        and public.obx_fn_pode_editar_rdo(r.id)
    )
  )
  and (
    eap_item_id is null
    or exists (
      select 1 from public.obx_eap_itens as e
      where e.id = obx_fotos.eap_item_id and e.obra_id = obx_fotos.obra_id
    )
  )
);

drop policy obx_fotos_delete on public.obx_fotos;
create policy obx_fotos_delete on public.obx_fotos for delete to authenticated
using (
  public.obx_fn_pode_registrar_campo(obra_id)
  and (
    rdo_id is null
    or exists (
      select 1 from public.obx_rdos as r
      where r.id = obx_fotos.rdo_id
        and r.obra_id = obx_fotos.obra_id
        and r.status = 'rascunho'
        and public.obx_fn_pode_editar_rdo(r.id)
    )
  )
);

drop policy obx_storage_fotos_select on storage.objects;
create policy obx_storage_fotos_select on storage.objects for select to authenticated
using (
  bucket_id = 'obx_fotos'
  and case
    when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      then public.obx_fn_pode_ver_obra(split_part(name, '/', 1)::uuid)
        and exists (
          select 1 from public.obx_rdos as r
          where r.id = split_part(name, '/', 2)::uuid
            and r.obra_id = split_part(name, '/', 1)::uuid
        )
    else false
  end
);

drop policy obx_storage_fotos_insert on storage.objects;
create policy obx_storage_fotos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'obx_fotos'
  and case
    when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
        and exists (
          select 1 from public.obx_rdos as r
          where r.id = split_part(name, '/', 2)::uuid
            and r.obra_id = split_part(name, '/', 1)::uuid
            and r.status = 'rascunho'
        )
    else false
  end
);

drop policy obx_storage_fotos_update on storage.objects;
create policy obx_storage_fotos_update on storage.objects for update to authenticated
using (
  bucket_id = 'obx_fotos'
  and case
    when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
        and exists (
          select 1 from public.obx_rdos as r
          where r.id = split_part(name, '/', 2)::uuid
            and r.obra_id = split_part(name, '/', 1)::uuid
            and r.status = 'rascunho'
        )
    else false
  end
)
with check (
  bucket_id = 'obx_fotos'
  and case
    when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
        and exists (
          select 1 from public.obx_rdos as r
          where r.id = split_part(name, '/', 2)::uuid
            and r.obra_id = split_part(name, '/', 1)::uuid
            and r.status = 'rascunho'
        )
    else false
  end
);

drop policy obx_storage_fotos_delete on storage.objects;
create policy obx_storage_fotos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'obx_fotos'
  and case
    when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      then public.obx_fn_pode_registrar_campo(split_part(name, '/', 1)::uuid)
        and exists (
          select 1 from public.obx_rdos as r
          where r.id = split_part(name, '/', 2)::uuid
            and r.obra_id = split_part(name, '/', 1)::uuid
            and r.status = 'rascunho'
        )
    else false
  end
);
