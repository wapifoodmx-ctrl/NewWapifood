-- Cierre de huecos: código confirmación, delivery, plan vigente, todo automático

alter table public.restaurant_profiles
  add column if not exists confirmation_code text,
  add column if not exists delivery_enabled boolean not null default false,
  add column if not exists require_confirm_code boolean not null default true;

-- Genera código de 4 dígitos si falta
create or replace function public.ensure_restaurant_profile(p_restaurant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select confirmation_code into v_code
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;

  if not found then
    v_code := lpad((floor(random()*10000))::int::text, 4, '0');
    insert into public.restaurant_profiles (restaurant_id, confirmation_code, require_confirm_code, delivery_enabled)
    values (p_restaurant, v_code, true, false);
  elsif v_code is null or length(trim(v_code)) < 4 then
    v_code := lpad((floor(random()*10000))::int::text, 4, '0');
    update public.restaurant_profiles
      set confirmation_code = v_code
    where restaurant_id = p_restaurant;
  end if;
end;
$$;

-- ¿Plan vigente?
create or replace function public.has_active_plan(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.restaurant_id = p_restaurant
      and s.status in ('active', 'trialing')
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

revoke all on function public.has_active_plan(uuid) from public;
grant execute on function public.has_active_plan(uuid) to authenticated, anon;

-- Pedido público con código de confirmación opcional
create or replace function public.place_public_order(
  p_restaurant uuid,
  p_table uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_notes text default null,
  p_confirm_code text default null
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
  v_req boolean;
  v_code text;
begin
  perform public.ensure_restaurant_profile(p_restaurant);

  select require_confirm_code, confirmation_code
    into v_req, v_code
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;

  if coalesce(v_req, false) then
    if p_confirm_code is null or trim(p_confirm_code) <> coalesce(v_code, '') then
      raise exception 'código de confirmación inválido';
    end if;
  end if;

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

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text) to anon, authenticated;

-- Onboarding: perfil + trial (reafirma create_my_restaurant)
create or replace function public.create_my_restaurant(p_name text default 'Mi restaurante')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then raise exception 'no autenticado'; end if;

  select restaurant_id into v_rid from public.memberships where user_id = v_uid limit 1;
  if v_rid is not null then
    perform public.ensure_restaurant_profile(v_rid);
    return v_rid;
  end if;

  if v_name is null then v_name := 'Mi restaurante'; end if;

  insert into public.restaurants (name) values (v_name) returning id into v_rid;
  insert into public.memberships (restaurant_id, user_id, role) values (v_rid, v_uid, 'owner');

  insert into public.dining_tables (restaurant_id, number, seats, state, active)
  select v_rid, n, case when n % 3 = 0 then 4 else 2 end, 'libre', true
  from generate_series(1, 8) as n;

  insert into public.categories (restaurant_id, name) values
    (v_rid, 'Tacos'), (v_rid, 'Antojitos'), (v_rid, 'Bebidas');

  insert into public.subscriptions (restaurant_id, plan, status, amount, billing, provider, ends_at)
  values (v_rid, 'ventas', 'trialing', 0, 'mensual', 'trial', now() + interval '14 days');

  perform public.ensure_restaurant_profile(v_rid);
  return v_rid;
end;
$$;

-- Merma de inventario (automática vía app)
create or replace function public.register_merma(
  p_ingredient uuid,
  p_qty numeric,
  p_note text default 'merma'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_stock numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'cantidad inválida'; end if;

  select restaurant_id, stock into v_rid, v_stock
  from public.ingredients where id = p_ingredient;
  if v_rid is null then raise exception 'insumo no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  update public.ingredients
    set stock = greatest(0, stock - p_qty)
  where id = p_ingredient;

  insert into public.stock_moves (ingredient_id, qty, reason)
  values (p_ingredient, -p_qty, coalesce(nullif(trim(p_note), ''), 'merma'));
end;
$$;

revoke all on function public.register_merma(uuid, numeric, text) from public;
grant execute on function public.register_merma(uuid, numeric, text) to authenticated;
