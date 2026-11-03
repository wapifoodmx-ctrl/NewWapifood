-- BLOQUE 5+6: campos delivery en órdenes + índices útiles reportes

alter table public.orders
  add column if not exists order_type text not null default 'mesa',
  add column if not exists customer_phone text,
  add column if not exists delivery_address text;

do $$ begin
  alter table public.orders drop constraint if exists orders_order_type_check;
  alter table public.orders
    add constraint orders_order_type_check
    check (order_type in ('mesa', 'domicilio'));
exception when others then null;
end $$;

-- place_public_order con domicilio
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
  v_req boolean;
  v_code text;
  v_source text := coalesce(nullif(trim(p_source), ''), 'web_menu');
  v_status text;
  v_needs boolean := false;
  v_channel text;
  v_type text := coalesce(nullif(trim(p_order_type), ''), 'mesa');
  v_delivery boolean;
begin
  if not public.can_operate(p_restaurant) then
    raise exception 'el restaurante no tiene un plan activo; no se pueden recibir pedidos';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito vacío';
  end if;

  if v_type not in ('mesa', 'domicilio') then
    raise exception 'tipo de pedido inválido';
  end if;

  select coalesce(delivery_enabled, false) into v_delivery
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;

  if v_type = 'domicilio' then
    if not coalesce(v_delivery, false) then
      raise exception 'este restaurante no tiene domicilio habilitado';
    end if;
    if p_delivery_address is null or length(trim(p_delivery_address)) < 5 then
      raise exception 'indica una dirección de entrega';
    end if;
    -- domicilio no exige mesa; usamos mesa kiosko o primera activa si no hay table
    if p_table is null then
      select id into p_table
      from public.dining_tables
      where restaurant_id = p_restaurant and active = true
      order by case when channel_type = 'kiosko' then 0 else 1 end, number
      limit 1;
    end if;
  else
    if p_table is null then
      raise exception 'restaurante y mesa requeridos';
    end if;
  end if;

  if p_table is not null then
    select channel_type into v_channel
    from public.dining_tables
    where id = p_table and restaurant_id = p_restaurant and active = true;
    if v_channel is null and v_type = 'mesa' then
      raise exception 'mesa inválida';
    end if;
  end if;

  if v_source = 'web_menu' then
    select require_confirm_code, confirmation_code
      into v_req, v_code
    from public.restaurant_profiles
    where restaurant_id = p_restaurant;

    if v_type = 'domicilio' then
      -- encargos a domicilio siempre pendientes de confirmar
      v_status := 'pendiente';
      v_needs := true;
    elsif coalesce(v_req, false) then
      if p_confirm_code is null or trim(p_confirm_code) <> coalesce(v_code, '') then
        v_status := 'pendiente';
        v_needs := true;
      else
        v_status := 'cocina';
        v_needs := false;
      end if;
    else
      v_status := 'pendiente';
      v_needs := true;
    end if;
  else
    v_status := 'cocina';
    v_needs := false;
  end if;

  insert into public.orders (
    restaurant_id, table_id, status, source, needs_confirmation,
    order_type, customer_phone, delivery_address
  ) values (
    p_restaurant, p_table, v_status, v_source, v_needs,
    v_type, nullif(trim(p_customer_phone), ''), nullif(trim(p_delivery_address), '')
  ) returning id into v_order;

  if v_type = 'mesa' and p_table is not null then
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
    insert into public.order_items (order_id, product_id, qty, unit_price)
    values (v_order, v_pid, v_qty, v_price)
    on conflict (order_id, product_id) do update
      set qty = public.order_items.qty + excluded.qty;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) to anon, authenticated;

-- Mantener overload anterior si existe (6-7 args) redirigiendo no es trivial en PG;
-- el cliente debe enviar los nuevos params opcionales.
