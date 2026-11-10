-- Varias líneas del mismo platillo si la nota es distinta.
-- No borra líneas vivas. El adicional queda pegado a la línea.

create unique index if not exists order_items_one_per_notes
  on public.order_items (order_id, product_id, (coalesce(notes, '')));

alter table public.order_item_extras
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists order_item_id uuid references public.order_items(id) on delete cascade;

update public.order_item_extras x
set order_item_id = (
  select i.id from public.order_items i
  where i.order_id = x.order_id and i.product_id = x.product_id
  order by i.id
  limit 1
)
where x.order_item_id is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_item_extras'::regclass
      and conname = 'order_item_extras_pkey'
      and pg_get_constraintdef(oid) not ilike '%(id)%'
  ) then
    alter table public.order_item_extras drop constraint order_item_extras_pkey;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_item_extras'::regclass and contype = 'p'
  ) then
    alter table public.order_item_extras alter column id set not null;
    alter table public.order_item_extras add constraint order_item_extras_pkey primary key (id);
  end if;
end $$;

create unique index if not exists order_item_extras_line_idx
  on public.order_item_extras (order_item_id, ingredient_id);
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
  v_line uuid;
  v_item jsonb;
  v_ex jsonb;
  v_pid uuid;
  v_ing uuid;
  v_qty integer;
  v_price numeric;
  v_status text;
  v_need_code boolean;
  v_code text;
  v_extra_qty numeric;
  v_extra_price numeric;
  v_item_notes text;
  v_source text;
  v_type text;
begin
  if p_restaurant is null then raise exception 'restaurante requerido'; end if;
  if not public.can_operate(p_restaurant) then
    raise exception 'el restaurante no tiene un plan activo';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito vacío';
  end if;

  v_source := coalesce(nullif(trim(p_source), ''), 'web_menu');
  v_type := coalesce(nullif(trim(p_order_type), ''), 'mesa');
  if v_source not in ('pos','mesero','tablet','kiosko','web_menu') then
    v_source := 'web_menu';
  end if;
  if v_type not in ('mesa','domicilio') then
    v_type := 'mesa';
  end if;
  if v_type = 'mesa' and p_table is null then
    raise exception 'mesa requerida';
  end if;
  if p_table is not null and not exists (
    select 1 from public.dining_tables t
    where t.id = p_table and t.restaurant_id = p_restaurant and t.active = true
      and t.state::text <> 'no_disponible'
  ) then
    raise exception 'mesa inválida o no disponible';
  end if;

  select coalesce(require_confirm_code, false), confirmation_code
    into v_need_code, v_code
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;

  if v_source = 'web_menu' and v_type = 'mesa' and v_need_code then
    if p_confirm_code is null or trim(p_confirm_code) <> coalesce(v_code, '') then
      raise exception 'código de confirmación inválido';
    end if;
  end if;

  v_status := case when v_type = 'domicilio' then 'pendiente' else 'cocina' end;

  insert into public.orders (
    restaurant_id, table_id, status, source, order_type,
    customer_name, notes, customer_phone, delivery_address, needs_confirmation
  ) values (
    p_restaurant,
    p_table,
    v_status::public.order_status,
    v_source,
    v_type,
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_notes), ''),
    nullif(trim(p_customer_phone), ''),
    case when v_type = 'domicilio' then nullif(trim(p_delivery_address), '') else null end,
    v_status = 'pendiente'
  )
  returning id into v_order;

  if p_table is not null and v_status <> 'pendiente' then
    update public.dining_tables set state = 'ocupada'::public.table_state where id = p_table;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'qty')::int, 1));
    v_item_notes := nullif(trim(coalesce(v_item->>'notes', v_item->>'note')), '');
    select price into v_price
    from public.products
    where id = v_pid and restaurant_id = p_restaurant and active = true;
    if v_price is null then raise exception 'producto inválido'; end if;

    insert into public.order_items (order_id, product_id, qty, unit_price, status, notes)
    values (v_order, v_pid, v_qty, v_price, 'pendiente', v_item_notes)
    on conflict (order_id, product_id, (coalesce(notes, ''))) do update
      set qty = public.order_items.qty + excluded.qty,
          notes = coalesce(excluded.notes, public.order_items.notes),
          status = case
            when public.order_items.status = 'cancelado' then 'pendiente'
            else public.order_items.status
          end
    returning id into v_line;

    if v_item ? 'extras' and jsonb_typeof(v_item->'extras') = 'array' then
      for v_ex in select * from jsonb_array_elements(v_item->'extras')
      loop
        v_ing := nullif(v_ex->>'ingredient_id', '')::uuid;
        v_extra_qty := null;
        v_extra_price := null;
        select pe.qty, pe.extra_price into v_extra_qty, v_extra_price
        from public.product_extras pe
        join public.ingredients i on i.id = pe.ingredient_id
        where pe.product_id = v_pid
          and pe.ingredient_id = v_ing
          and i.restaurant_id = p_restaurant
          and coalesce(i.is_extra, false) = true;
        if not found then continue; end if;
        insert into public.order_item_extras (order_id, product_id, order_item_id, ingredient_id, qty, extra_price)
        values (v_order, v_pid, v_line, v_ing, v_extra_qty, v_extra_price)
        on conflict (order_item_id, ingredient_id) do update
          set qty = excluded.qty, extra_price = excluded.extra_price;
      end loop;
    end if;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.close_order(
  p_order uuid,
  p_method text default 'efectivo',
  p_cash numeric default null,
  p_tip numeric default 0,
  p_tip_method text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
  v_table uuid;
  v_applied boolean;
  v_method text;
  v_tip numeric;
  v_tip_method text;
  v_food numeric;
  v_due numeric;
  v_cash numeric;
  v_change numeric;
  v_session uuid;
  r record;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, status::text, table_id, coalesce(stock_applied, false)
    into v_rid, v_status, v_table, v_applied
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden ya cerrada'; end if;

  v_method := coalesce(nullif(trim(p_method), ''), 'efectivo');
  if v_method not in ('efectivo', 'tarjeta', 'transferencia') then
    raise exception 'método de pago inválido';
  end if;

  v_tip := round(greatest(0, coalesce(p_tip, 0)), 2);
  v_tip_method := coalesce(nullif(trim(p_tip_method), ''), v_method);
  if v_tip_method not in ('efectivo', 'tarjeta', 'transferencia') then
    v_tip_method := v_method;
  end if;

  v_food := public.order_food_total(p_order);
  v_due := round(v_food + v_tip, 2);
  v_cash := case when p_cash is null then null else round(p_cash, 2) end;
  if v_method = 'efectivo' and v_cash is not null and v_cash + 0.001 < v_due then
    raise exception 'el efectivo recibido no alcanza el total';
  end if;
  v_change := case
    when v_method = 'efectivo' and v_cash is not null then round(greatest(0, v_cash - v_due), 2)
    else null
  end;

  if not v_applied then
    for r in
      select rl.ingredient_id, sum(rl.qty * oi.qty) as need
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.recipe_lines rl on rl.product_id = oi.product_id
      where oi.order_id = p_order
        and coalesce(oi.status, 'pendiente') <> 'cancelado'
        and coalesce(p.inventory_mode, 'unitario') <> 'none'
      group by rl.ingredient_id
    loop
      update public.ingredients
        set stock = greatest(0, stock - r.need)
      where id = r.ingredient_id and restaurant_id = v_rid;
      insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
      values (v_rid, r.ingredient_id, p_order, -r.need, 'venta', 'venta');
    end loop;

    for r in
      select x.ingredient_id, sum(x.qty * oi.qty) as need
      from public.order_item_extras x
      join public.order_items oi
        on oi.order_id = x.order_id
       and oi.product_id = x.product_id
       and (x.order_item_id is null or oi.id = x.order_item_id)
      where x.order_id = p_order
        and coalesce(oi.status, 'pendiente') <> 'cancelado'
      group by x.ingredient_id
    loop
      update public.ingredients
        set stock = greatest(0, stock - r.need)
      where id = r.ingredient_id and restaurant_id = v_rid;
      insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
      values (v_rid, r.ingredient_id, p_order, -r.need, 'venta', 'adicional');
    end loop;
  end if;

  update public.orders
    set status = 'pagada'::public.order_status,
        method = v_method::public.pay_method,
        payment_method = v_method,
        closed_at = now(),
        stock_applied = true,
        tip_amount = v_tip,
        tip_method = v_tip_method::public.pay_method,
        charged_food = v_food,
        cash_tendered = case when v_method = 'efectivo' then v_cash else null end,
        change_amount = v_change
  where id = p_order;

  if v_tip > 0 and v_tip_method = 'efectivo' then
    select id into v_session
    from public.cash_sessions
    where restaurant_id = v_rid and status = 'open'
    limit 1;
    if v_session is not null then
      insert into public.cash_movements (session_id, restaurant_id, order_id, kind, amount, note)
      values (v_session, v_rid, p_order, 'propina_efectivo', v_tip, 'propina');
    end if;
  end if;

  update public.dining_tables set state = 'libre' where id = v_table;
end;
$$;

revoke all on function public.close_order(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.close_order(uuid, text, numeric, numeric, text) to authenticated;

drop function if exists public.set_item_discount(uuid, uuid, text, numeric, text);

create or replace function public.set_item_discount(
  p_order uuid,
  p_product uuid,
  p_type text,
  p_value numeric,
  p_pin text default null,
  p_item uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
  v_sub numeric;
  v_amt numeric;
  v_order_type text;
  v_order_value numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_type is not null and p_type not in ('porcentaje', 'monto') then
    raise exception 'tipo descuento inválido';
  end if;
  select restaurant_id, status::text, discount_type, coalesce(discount_value, 0)
    into v_rid, v_status, v_order_type, v_order_value
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;
  if p_type is not null and coalesce(p_value, 0) > 0 then
    perform public.assert_manager_pin(v_rid, p_pin);
  end if;
  if p_type = 'porcentaje' and (p_value < 0 or p_value > 100) then
    raise exception 'el porcentaje debe estar entre 0 y 100';
  end if;
  if p_type = 'monto' and coalesce(p_value, 0) < 0 then
    raise exception 'el descuento no puede ser negativo';
  end if;
  if p_type is null or coalesce(p_value, 0) <= 0 then
    update public.order_items
      set discount_type = null, discount_value = 0
    where order_id = p_order and product_id = p_product
      and (p_item is null or id = p_item);
  else
    update public.order_items
      set discount_type = p_type, discount_value = round(p_value, 2)
    where order_id = p_order and product_id = p_product
      and (p_item is null or id = p_item);
  end if;
  if not found then raise exception 'ítem no existe en la orden'; end if;
  v_sub := public.order_subtotal(p_order);
  if v_order_type is null or v_order_value <= 0 then
    update public.orders set discount_amount = 0 where id = p_order;
  elsif v_order_type = 'porcentaje' then
    v_amt := round(v_sub * v_order_value / 100.0, 2);
    update public.orders set discount_amount = least(v_sub, v_amt) where id = p_order;
  else
    update public.orders set discount_amount = least(v_sub, v_order_value) where id = p_order;
  end if;
  if p_type is not null and coalesce(p_value, 0) > 0 then
    insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
    values (v_rid, p_order, auth.uid(), 'descuento', 'Descuento en un platillo', jsonb_build_object('product_id', p_product, 'item_id', p_item, 'type', p_type, 'value', p_value));
  end if;
end;
$$;

revoke all on function public.set_item_discount(uuid, uuid, text, numeric, text, uuid) from public, anon;
grant execute on function public.set_item_discount(uuid, uuid, text, numeric, text, uuid) to authenticated;
