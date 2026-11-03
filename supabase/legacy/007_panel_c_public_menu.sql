-- Panel C: lectura pública de carta + pedido desde menú / kiosko / mesero

-- Catálogo visible sin login (solo lo necesario para menú digital)
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated
  using (active = true);

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (true);

drop policy if exists restaurants_public_read on public.restaurants;
create policy restaurants_public_read on public.restaurants
  for select to anon, authenticated
  using (true);

drop policy if exists menu_theme_public_read on public.menu_theme;
create policy menu_theme_public_read on public.menu_theme
  for select to anon, authenticated
  using (true);

drop policy if exists tables_public_read on public.dining_tables;
create policy tables_public_read on public.dining_tables
  for select to anon, authenticated
  using (active = true);

-- Pedido público (cliente / kiosko)
create or replace function public.place_public_order(
  p_restaurant uuid,
  p_table uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_item jsonb;
  v_pid uuid;
  v_qty numeric;
  v_price numeric;
begin
  if p_restaurant is null or p_table is null then
    raise exception 'restaurante y mesa requeridos';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito vacío';
  end if;

  if not exists (
    select 1 from public.dining_tables t
    where t.id = p_table and t.restaurant_id = p_restaurant and t.active = true
  ) then
    raise exception 'mesa inválida';
  end if;

  insert into public.orders (restaurant_id, table_id, status)
  values (p_restaurant, p_table, 'cocina')
  returning id into v_order;

  update public.dining_tables set state = 'ocupada' where id = p_table;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'qty')::numeric, 1));
    select price into v_price
    from public.products
    where id = v_pid and restaurant_id = p_restaurant and active = true;
    if v_price is null then
      raise exception 'producto inválido %', v_pid;
    end if;
    insert into public.order_items (order_id, product_id, qty, unit_price)
    values (v_order, v_pid, v_qty, v_price)
    on conflict (order_id, product_id) do update
      set qty = public.order_items.qty + excluded.qty;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text) to anon, authenticated;

-- Login mesero por código (sin exponer todos los códigos)
create or replace function public.waiter_login(p_restaurant uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w public.waiters%rowtype;
  v_tables uuid[];
begin
  select * into v_w
  from public.waiters
  where restaurant_id = p_restaurant
    and access_code = p_code
    and active = true
  limit 1;

  if not found then
    raise exception 'código inválido';
  end if;

  select coalesce(array_agg(table_id), '{}') into v_tables
  from public.waiter_tables
  where waiter_id = v_w.id;

  return jsonb_build_object(
    'id', v_w.id,
    'name', v_w.name,
    'restaurant_id', v_w.restaurant_id,
    'table_ids', to_jsonb(v_tables)
  );
end;
$$;

revoke all on function public.waiter_login(uuid, text) from public;
grant execute on function public.waiter_login(uuid, text) to anon, authenticated;
