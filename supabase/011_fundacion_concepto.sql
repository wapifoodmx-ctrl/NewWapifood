-- FUNDACIÓN WAPIFOOD
-- 1) Onboarding SIN datos de negocio del cliente (no mesas, no categorías, no productos)
-- 2) Solo tenant + owner + trial de configuración
-- 3) Ventas / menú público requieren plan status = active (no trial)

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
  if v_uid is null then
    raise exception 'no autenticado';
  end if;

  select restaurant_id into v_rid
  from public.memberships
  where user_id = v_uid
  limit 1;

  if v_rid is not null then
    return v_rid;
  end if;

  if v_name is null then
    v_name := 'Mi restaurante';
  end if;

  -- Solo contenedor del cliente. CERO mesas/productos/categorías inventadas.
  insert into public.restaurants (name)
  values (v_name)
  returning id into v_rid;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_rid, v_uid, 'owner');

  -- Trial: solo para configurar el panel, NO para vender
  insert into public.subscriptions (
    restaurant_id, plan, status, amount, billing, provider, ends_at
  ) values (
    v_rid, 'ventas', 'trialing', 0, 'mensual', 'trial', now() + interval '14 days'
  );

  -- Perfil vacío (código se genera sin datos de menú)
  insert into public.restaurant_profiles (
    restaurant_id, confirmation_code, require_confirm_code, delivery_enabled
  ) values (
    v_rid,
    lpad((floor(random() * 10000))::int::text, 4, '0'),
    true,
    false
  )
  on conflict (restaurant_id) do nothing;

  return v_rid;
end;
$$;

revoke all on function public.create_my_restaurant(text) from public;
grant execute on function public.create_my_restaurant(text) to authenticated;

-- ¿Puede OPERAR ventas y canales públicos? Solo plan active vigente
create or replace function public.can_operate(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.restaurant_id = p_restaurant
      and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

revoke all on function public.can_operate(uuid) from public;
grant execute on function public.can_operate(uuid) to anon, authenticated;

-- Pedidos públicos solo si el local puede operar
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
  if not public.can_operate(p_restaurant) then
    raise exception 'el restaurante no tiene un plan activo; no se pueden recibir pedidos';
  end if;

  if p_restaurant is null or p_table is null then
    raise exception 'restaurante y mesa requeridos';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito vacío';
  end if;

  select require_confirm_code, confirmation_code
    into v_req, v_code
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;

  if coalesce(v_req, false) then
    if p_confirm_code is null or trim(p_confirm_code) <> coalesce(v_code, '') then
      raise exception 'código de confirmación inválido';
    end if;
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
      raise exception 'producto inválido';
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
