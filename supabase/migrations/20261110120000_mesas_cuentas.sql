-- Juntar, transferir y dividir cuentas.
-- Una mesa solo tiene una cuenta abierta. La parte dividida queda como cuenta aparte en estado entregada.

alter table public.orders
  add column if not exists parent_order_id uuid references public.orders(id);

alter table public.orders
  add column if not exists portion_due numeric(10,2);

alter table public.orders
  add column if not exists covered_amount numeric(10,2) not null default 0;

create or replace function public.transfer_table(p_order uuid, p_table uuid, p_pin text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_from uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, table_id, status::text into v_rid, v_from, v_status
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'esa cuenta ya está cerrada'; end if;
  perform public.assert_manager_pin(v_rid, p_pin);
  if not exists (
    select 1 from public.dining_tables
    where id = p_table and restaurant_id = v_rid
  ) then
    raise exception 'esa mesa no es de este local';
  end if;
  if exists (
    select 1 from public.orders
    where table_id = p_table and id <> p_order
      and status::text in ('pendiente', 'abierta', 'cocina', 'lista')
  ) then
    raise exception 'esa mesa ya tiene una cuenta abierta';
  end if;
  update public.orders set table_id = p_table where id = p_order;
  update public.dining_tables set state = 'ocupado'::public.table_state where id = p_table;
  if v_from is not null and not exists (
    select 1 from public.orders
    where table_id = v_from and status::text in ('pendiente', 'abierta', 'cocina', 'lista')
  ) then
    update public.dining_tables set state = 'libre'::public.table_state
    where id = v_from and state::text is distinct from 'no_disponible';
  end if;
  insert into public.action_log (restaurant_id, order_id, actor, action, summary)
  values (v_rid, p_order, auth.uid(), 'transferir', 'La cuenta cambió de mesa');
end;
$$;

create or replace function public.move_order_items(
  p_from uuid,
  p_to uuid,
  p_items jsonb,
  p_pin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_to uuid;
  item jsonb;
  v_product uuid;
  v_qty integer;
  v_have integer;
  v_price numeric;
  v_notes text;
  v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id into v_rid from public.orders where id = p_from;
  select restaurant_id into v_to from public.orders where id = p_to;
  if v_rid is null or v_to is null or v_rid <> v_to then raise exception 'las cuentas no son del mismo local'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  perform public.assert_manager_pin(v_rid, p_pin);
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_product := (item->>'product_id')::uuid;
    v_qty := coalesce((item->>'qty')::integer, 0);
    if v_qty <= 0 then continue; end if;
    select qty, unit_price, notes, status into v_have, v_price, v_notes, v_status
    from public.order_items where order_id = p_from and product_id = v_product;
    if v_have is null or v_qty > v_have then raise exception 'no hay tantas piezas para mover'; end if;
    if exists (select 1 from public.order_items where order_id = p_to and product_id = v_product and coalesce(notes, '') = coalesce(v_notes, '')) then
      update public.order_items
        set qty = qty + v_qty
      where order_id = p_to and product_id = v_product and coalesce(notes, '') = coalesce(v_notes, '');
    else
      insert into public.order_items (order_id, product_id, qty, unit_price, notes, status)
      values (p_to, v_product, v_qty, v_price, v_notes, coalesce(v_status, 'pendiente'));
    end if;
    if v_qty = v_have then
      delete from public.order_items where order_id = p_from and product_id = v_product and coalesce(notes, '') = coalesce(v_notes, '');
    else
      update public.order_items set qty = qty - v_qty
      where order_id = p_from and product_id = v_product and coalesce(notes, '') = coalesce(v_notes, '');
    end if;
  end loop;
  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (v_rid, p_from, auth.uid(), 'mover', 'Se pasaron platillos a otra cuenta', p_items);
end;
$$;

create or replace function public.merge_orders(p_from uuid, p_to uuid, p_pin text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  select jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty))
    into v_items
  from public.order_items where order_id = p_from;
  perform public.move_order_items(p_from, p_to, coalesce(v_items, '[]'::jsonb), p_pin);
  perform set_config('wapifood.skip_manager_pin', '1', true);
  update public.orders
    set status = 'cancelada'::public.order_status,
        cancel_reason = 'juntada con otra cuenta',
        closed_at = now()
  where id = p_from;
  update public.dining_tables t
    set state = 'libre'::public.table_state
  where t.id = (select table_id from public.orders where id = p_from)
    and t.state::text is distinct from 'no_disponible'
    and not exists (
      select 1 from public.orders o
      where o.table_id = t.id and o.status::text in ('pendiente', 'abierta', 'cocina', 'lista')
    );
end;
$$;

create or replace function public.split_order(
  p_order uuid,
  p_mode text,
  p_payload jsonb,
  p_pin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_table uuid;
  v_waiter uuid;
  v_new uuid;
  v_amount numeric;
  v_due numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, table_id, waiter_id into v_rid, v_table, v_waiter
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  perform public.assert_manager_pin(v_rid, p_pin);
  if p_mode not in ('platillo', 'persona', 'monto') then raise exception 'elige cómo dividir'; end if;

  insert into public.orders (restaurant_id, table_id, status, source, order_type, waiter_id, parent_order_id, stock_applied)
  values (v_rid, v_table, 'entregada'::public.order_status, 'pos', 'mesa', v_waiter, p_order, p_mode = 'monto')
  returning id into v_new;

  if p_mode = 'monto' then
    v_amount := round(coalesce((p_payload->>'amount')::numeric, 0), 2);
    if v_amount <= 0 then raise exception 'escribe el monto'; end if;
    v_due := public.order_subtotal(p_order);
    if v_amount > v_due then raise exception 'el monto es mayor que la cuenta'; end if;
    update public.orders set portion_due = v_amount where id = v_new;
    update public.orders set covered_amount = covered_amount + v_amount where id = p_order;
  else
    perform public.move_order_items(p_order, v_new, coalesce(p_payload->'items', '[]'::jsonb), p_pin);
  end if;

  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (v_rid, p_order, auth.uid(), 'dividir', 'Se dividió la cuenta', jsonb_build_object('mode', p_mode, 'new_order', v_new));
  return v_new;
end;
$$;

revoke all on function public.transfer_table(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.move_order_items(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.merge_orders(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.split_order(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.transfer_table(uuid, uuid, text) to authenticated;
grant execute on function public.move_order_items(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.merge_orders(uuid, uuid, text) to authenticated;
grant execute on function public.split_order(uuid, text, jsonb, text) to authenticated;
