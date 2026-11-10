-- El menu web guarda los modificadores en la misma linea del platillo.

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
  r record;
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
    if v_item ? 'modifiers' and jsonb_typeof(v_item->'modifiers') = 'array' then
      for v_ex in select * from jsonb_array_elements(v_item->'modifiers')
      loop
        insert into public.order_item_modifiers (order_item_id, order_id, option_id, name, extra_price)
        select v_line, v_order, o.id, o.name, o.extra_price
        from public.modifier_options o
        join public.product_modifier_groups pg on pg.group_id = o.group_id and pg.product_id = v_pid
        where o.id = nullif(v_ex->>'option_id', '')::uuid;
      end loop;
    end if;
    for r in
      select g.name, g.min_select, g.max_select, g.required,
        (
          select count(*)
          from public.order_item_modifiers m
          join public.modifier_options o on o.id = m.option_id
          where m.order_item_id = v_line and o.group_id = g.id
        ) as picked
      from public.modifier_groups g
      join public.product_modifier_groups pg on pg.group_id = g.id
      where pg.product_id = v_pid
    loop
      if r.picked < case when r.required then greatest(r.min_select, 1) else r.min_select end then
        raise exception 'faltan opciones en %', r.name;
      end if;
      if r.picked > r.max_select then
        raise exception 'sobran opciones en %', r.name;
      end if;
    end loop;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) to anon, authenticated;
