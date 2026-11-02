-- ============================================================
-- Canales POS / mesas / mesero / kiosko + consulta permanente de estados
-- - place_public_order deja ítems en pendiente y mesa ocupada
-- - Asegura mesa kiosko del restaurante
-- - Beeper: lectura pública de órdenes e ítems (refuerzo)
-- ============================================================

-- Columnas de status de ítem (si 023 no corrió)
alter table public.order_items
  add column if not exists status text default 'pendiente';

-- place_public_order robusto (misma firma que 016)
create or replace function public.place_public_order(
  p_restaurant uuid,
  p_table uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_notes text default null,
  p_confirm_code text default null,
  p_source text default 'web_menu',
  p_order_type text default 'mesa',
  p_customer_phone text default null,
  p_delivery_address text default null
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
  v_status text;
  v_need_code boolean;
  v_code text;
begin
  if p_restaurant is null then raise exception 'restaurante requerido'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito vacío';
  end if;

  if p_order_type = 'mesa' and p_table is null then
    raise exception 'mesa requerida';
  end if;

  if p_table is not null then
    if not exists (
      select 1 from public.dining_tables t
      where t.id = p_table and t.restaurant_id = p_restaurant and t.active = true
        and coalesce(t.state, 'libre') <> 'no_disponible'
    ) then
      raise exception 'mesa inválida o no disponible';
    end if;
  end if;

  -- Código de confirmación (solo web_menu + mesa)
  select coalesce(require_confirm_code, false), confirmation_code
    into v_need_code, v_code
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;

  if p_source = 'web_menu' and p_order_type = 'mesa' and v_need_code then
    if p_confirm_code is null or trim(p_confirm_code) <> coalesce(v_code, '') then
      raise exception 'código de confirmación inválido';
    end if;
  end if;

  -- Web/domicilio → pendiente; resto → cocina directa
  if p_source = 'web_menu' and (p_order_type = 'domicilio' or coalesce(v_need_code, false)) then
    -- si requiere código y ya validó, va a cocina; domicilio siempre pendiente
    if p_order_type = 'domicilio' then
      v_status := 'pendiente';
    else
      v_status := 'cocina';
    end if;
  elsif p_source = 'web_menu' and p_order_type = 'domicilio' then
    v_status := 'pendiente';
  else
    v_status := 'cocina';
  end if;

  -- Domicilio siempre pendiente de confirmar en cocina
  if p_order_type = 'domicilio' then
    v_status := 'pendiente';
  end if;

  insert into public.orders (
    restaurant_id, table_id, status, source, order_type,
    customer_name, notes, customer_phone, delivery_address, needs_confirmation
  ) values (
    p_restaurant,
    p_table,
    v_status,
    coalesce(nullif(trim(p_source), ''), 'web_menu'),
    coalesce(nullif(trim(p_order_type), ''), 'mesa'),
    p_customer_name,
    p_notes,
    p_customer_phone,
    p_delivery_address,
    (v_status = 'pendiente')
  )
  returning id into v_order;

  if p_table is not null and v_status <> 'pendiente' then
    update public.dining_tables set state = 'ocupada' where id = p_table;
  end if;

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
    insert into public.order_items (order_id, product_id, qty, unit_price, status)
    values (v_order, v_pid, v_qty, v_price, 'pendiente')
    on conflict (order_id, product_id) do update
      set qty = public.order_items.qty + excluded.qty,
          status = case
            when public.order_items.status = 'cancelado' then 'pendiente'
            else public.order_items.status
          end;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) to anon, authenticated;

-- Asegurar mesa tipo kiosko (número 99 por defecto)
create or replace function public.ensure_kiosk_table(p_restaurant uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.dining_tables
  where restaurant_id = p_restaurant and channel_type = 'kiosko' and active = true
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.dining_tables (restaurant_id, number, seats, channel_type, state, active)
  values (p_restaurant, 99, 1, 'kiosko', 'libre', true)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ensure_kiosk_table(uuid) from public;
grant execute on function public.ensure_kiosk_table(uuid) to anon, authenticated;

-- Beeper: lectura pública reforzada (órdenes + ítems siempre consultables)
drop policy if exists orders_public_beeper on public.orders;
create policy orders_public_beeper on public.orders
  for select to anon, authenticated
  using (true);

drop policy if exists order_items_public_beeper on public.order_items;
create policy order_items_public_beeper on public.order_items
  for select to anon, authenticated
  using (true);

drop policy if exists dining_tables_public_read on public.dining_tables;
create policy dining_tables_public_read on public.dining_tables
  for select to anon, authenticated
  using (true);
