-- Modelo cerrado del QR de mesa.
-- No borra datos. Solo agrega funciones: el mesero abre si el dueño lo activó,
-- y caja puede editar un pedido que sigue por aceptar.
-- El precio sale de products. El cliente no manda el precio.

create or replace function public.waiter_can_open_table(
  p_restaurant uuid,
  p_waiter uuid,
  p_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_open boolean;
begin
  select exists (
    select 1 from public.waiters w
    where w.id = p_waiter
      and w.restaurant_id = p_restaurant
      and w.active = true
      and w.access_code = trim(coalesce(p_code, ''))
  ) into v_ok;
  if not v_ok then return false; end if;

  select coalesce(qr_auto_open, false) into v_open
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;
  return coalesce(v_open, false);
end;
$$;

create or replace function public.open_table_session_for_waiter(
  p_table uuid,
  p_waiter uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rid uuid;
  v_number int;
  v_channel text;
  v_slug text;
  v_order uuid;
  v_token text;
  v_id uuid;
  v_ok boolean;
  v_assigned int;
  v_open boolean;
begin
  if p_waiter is null or nullif(trim(coalesce(p_code, '')), '') is null then
    raise exception 'mesero o código inválido';
  end if;

  select restaurant_id, number, channel_type
    into v_rid, v_number, v_channel
  from public.dining_tables
  where id = p_table and active is true;
  if v_rid is null then raise exception 'mesa no existe'; end if;
  if v_channel not in ('piso', 'tablet') then raise exception 'esa mesa no se abre con QR'; end if;

  select exists (
    select 1 from public.waiters w
    where w.id = p_waiter
      and w.restaurant_id = v_rid
      and w.active = true
      and w.access_code = trim(p_code)
  ) into v_ok;
  if not v_ok then raise exception 'mesero o código inválido'; end if;

  select coalesce(qr_auto_open, false) into v_open
  from public.restaurant_profiles
  where restaurant_id = v_rid;
  if coalesce(v_open, false) is distinct from true then
    raise exception 'el local no permite que el mesero abra la mesa';
  end if;

  select count(*) into v_assigned from public.waiter_tables where waiter_id = p_waiter;
  if v_assigned > 0 and not exists (
    select 1 from public.waiter_tables
    where waiter_id = p_waiter and table_id = p_table
  ) then
    raise exception 'esa mesa no es tuya';
  end if;

  select slug into v_slug from public.restaurants where id = v_rid;

  select id into v_id
  from public.table_sessions
  where table_id = p_table and status = 'abierta'
  limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'slug', v_slug, 'number', v_number, 'already', true);
  end if;

  select id into v_order
  from public.orders
  where table_id = p_table and status::text not in ('pagada', 'cancelada')
  order by opened_at desc
  limit 1;
  if v_order is null then
    insert into public.orders (restaurant_id, table_id, status, source)
    values (v_rid, p_table, 'abierta', 'mesa')
    returning id into v_order;
  end if;

  begin
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.table_sessions (restaurant_id, table_id, token, opened_by, order_id)
    values (v_rid, p_table, v_token, null, v_order)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id
    from public.table_sessions
    where table_id = p_table and status = 'abierta'
    limit 1;
    return jsonb_build_object('id', v_id, 'slug', v_slug, 'number', v_number, 'already', true);
  end;

  insert into public.action_log (restaurant_id, order_id, action, summary, detail)
  values (
    v_rid,
    v_order,
    'mesa_qr',
    'El mesero abrió la mesa para el celular',
    jsonb_build_object('table_id', p_table, 'session_id', v_id, 'waiter_id', p_waiter)
  );

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'number', v_number, 'already', false);
end;
$$;

create or replace function public.revise_table_request(p_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_requests;
  s public.table_sessions;
  row jsonb;
  v_product uuid;
  v_qty int;
  v_price numeric;
  v_notes text;
  v_mods jsonb;
  v_clean jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select * into v from public.table_requests where id = p_id and status = 'pendiente';
  if v.id is null then raise exception 'ese aviso ya se atendió'; end if;
  if not public.is_member(v.restaurant_id) then raise exception 'sin permiso'; end if;
  if v.kind is distinct from 'pedido' then raise exception 'ese aviso no es un pedido'; end if;

  select * into s from public.table_sessions where id = v.session_id and status = 'abierta';
  if s.id is null then raise exception 'la mesa ya se cerró'; end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'el pedido está vacío';
  end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'el pedido es demasiado grande'; end if;

  for row in select * from jsonb_array_elements(p_items)
  loop
    v_product := nullif(row->>'product_id', '')::uuid;
    v_qty := least(20, greatest(1, coalesce((row->>'qty')::int, 1)));
    v_notes := left(coalesce(row->>'notes', ''), 240);
    select price into v_price from public.products
    where id = v_product and restaurant_id = v.restaurant_id and active is true;
    if v_price is null then raise exception 'ese platillo no es de esta mesa'; end if;
    v_mods := public.assert_product_modifiers(v_product, row->'modifiers');
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'product_id', v_product,
      'qty', v_qty,
      'price', v_price,
      'notes', nullif(v_notes, ''),
      'name', (select name from public.products where id = v_product),
      'modifiers', v_mods
    ));
  end loop;

  update public.table_requests
  set items = v_clean
  where id = p_id and status = 'pendiente';

  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (
    v.restaurant_id,
    s.order_id,
    auth.uid(),
    'mesa_qr',
    'Caja editó el pedido del celular',
    jsonb_build_object('request_id', p_id)
  );
end;
$$;

revoke all on function public.waiter_can_open_table(uuid, uuid, text) from public;
revoke all on function public.open_table_session_for_waiter(uuid, uuid, text) from public;
revoke all on function public.revise_table_request(uuid, jsonb) from public, anon;

grant execute on function public.waiter_can_open_table(uuid, uuid, text) to anon, authenticated;
grant execute on function public.open_table_session_for_waiter(uuid, uuid, text) to anon, authenticated;
grant execute on function public.revise_table_request(uuid, jsonb) to authenticated;
