-- BLOQUE 1: Canales de venta y tipos de mesa (fundamento Wapifood real)
-- caja = POS (mesa 1 / caja)
-- piso = mesas normales
-- tablet = tablet fija en una mesa
-- kiosko = punto de auto-servicio

alter table public.dining_tables
  add column if not exists channel_type text not null default 'piso',
  add column if not exists access_pin text;

-- Restringe valores lógicos (check suave)
do $$ begin
  alter table public.dining_tables
    drop constraint if exists dining_tables_channel_type_check;
  alter table public.dining_tables
    add constraint dining_tables_channel_type_check
    check (channel_type in ('caja', 'piso', 'tablet', 'kiosko'));
exception when others then null;
end $$;

-- Origen del pedido
alter table public.orders
  add column if not exists source text not null default 'pos',
  add column if not exists needs_confirmation boolean not null default false;

do $$ begin
  alter table public.orders drop constraint if exists orders_source_check;
  alter table public.orders
    add constraint orders_source_check
    check (source in ('pos', 'mesero', 'tablet', 'kiosko', 'web_menu'));
exception when others then null;
end $$;

-- Asegura una mesa caja (número 1) por restaurante si no hay ninguna caja
create or replace function public.ensure_channel_tables(p_restaurant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.dining_tables
    where restaurant_id = p_restaurant and channel_type = 'caja'
  ) then
    insert into public.dining_tables (restaurant_id, number, seats, state, active, channel_type)
    values (p_restaurant, 1, 1, 'libre', true, 'caja')
    on conflict do nothing;
    -- si number 1 ya existe como piso, lo promovemos a caja
    update public.dining_tables
      set channel_type = 'caja'
    where restaurant_id = p_restaurant and number = 1 and channel_type <> 'caja';
  end if;

  if not exists (
    select 1 from public.dining_tables
    where restaurant_id = p_restaurant and channel_type = 'kiosko'
  ) then
    insert into public.dining_tables (restaurant_id, number, seats, state, active, channel_type)
    select p_restaurant,
           coalesce((select max(number) from public.dining_tables where restaurant_id = p_restaurant), 0) + 1,
           1, 'libre', true, 'kiosko';
  end if;
end;
$$;

revoke all on function public.ensure_channel_tables(uuid) from public;
grant execute on function public.ensure_channel_tables(uuid) to authenticated;

-- place_public_order: soporta source + web pendiente de confirmación
create or replace function public.place_public_order(
  p_restaurant uuid,
  p_table uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_notes text default null,
  p_confirm_code text default null,
  p_source text default 'web_menu'
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
  v_source text := coalesce(nullif(trim(p_source), ''), 'web_menu');
  v_status text;
  v_needs boolean := false;
  v_channel text;
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

  select channel_type into v_channel
  from public.dining_tables
  where id = p_table and restaurant_id = p_restaurant and active = true;

  if v_channel is null then
    raise exception 'mesa inválida';
  end if;

  -- Menú web externo: puede quedar pendiente de confirmación
  if v_source = 'web_menu' then
    select require_confirm_code, confirmation_code
      into v_req, v_code
    from public.restaurant_profiles
    where restaurant_id = p_restaurant;

    if coalesce(v_req, false) then
      if p_confirm_code is null or trim(p_confirm_code) <> coalesce(v_code, '') then
        -- sin código válido → pendiente (encargo), no cocina directa
        v_status := 'pendiente';
        v_needs := true;
      else
        v_status := 'cocina';
        v_needs := false;
      end if;
    else
      -- sin exigir código: web queda pendiente por defecto (domicilio/encargo)
      v_status := 'pendiente';
      v_needs := true;
    end if;
  else
    -- tablet / kiosko / mesero: ya confirmados en local → cocina
    v_status := 'cocina';
    v_needs := false;
  end if;

  insert into public.orders (
    restaurant_id, table_id, status, source, needs_confirmation
  ) values (
    p_restaurant, p_table, v_status, v_source, v_needs
  ) returning id into v_order;

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

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text) to anon, authenticated;

-- Confirmar pedido web pendiente → pasa a cocina
create or replace function public.confirm_web_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
begin
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if auth.uid() is null or not public.is_member(v_rid) then
    raise exception 'sin permiso';
  end if;

  update public.orders
    set status = 'cocina', needs_confirmation = false
  where id = p_order and status = 'pendiente';
end;
$$;

revoke all on function public.confirm_web_order(uuid) from public;
grant execute on function public.confirm_web_order(uuid) to authenticated;
