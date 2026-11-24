-- «Se puede quitar» (is_displayable del legado) y la pantalla pública de una lista.
-- Quitar un insumo escribe «Sin X» en la nota. No cambia el descuento de stock:
-- el front viejo tampoco se lo mandaba a process-order.

alter table public.recipe_lines
  add column if not exists is_removable boolean not null default false;

create or replace function public.public_removable_lines(p_restaurant uuid)
returns table(product_id uuid, ingredient_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select rl.product_id, rl.ingredient_id, i.name
  from public.recipe_lines rl
  join public.products p on p.id = rl.product_id
  join public.ingredients i on i.id = rl.ingredient_id
  where p.restaurant_id = p_restaurant
    and i.restaurant_id = p_restaurant
    and p.active is true
    and rl.is_removable is true
  order by i.name;
$$;

revoke all on function public.public_removable_lines(uuid) from public;
grant execute on function public.public_removable_lines(uuid) to anon, authenticated;

create or replace function public.public_screen_list(p_list uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_list text;
  v_restaurant text;
begin
  select l.restaurant_id, l.name, r.name
    into v_rid, v_list, v_restaurant
  from public.product_lists l
  join public.restaurants r on r.id = l.restaurant_id
  where l.id = p_list;
  if v_rid is null then
    return null;
  end if;
  return jsonb_build_object(
    'restaurant', v_restaurant,
    'list', v_list,
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'price', p.price,
        'image_url', p.image_url,
        'category', c.name,
        'active', p.active
      ) order by i.sort_order, p.name)
      from public.product_list_items i
      join public.products p on p.id = i.product_id
      left join public.categories c on c.id = p.category_id
      where i.list_id = p_list
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.public_screen_list(uuid) from public;
grant execute on function public.public_screen_list(uuid) to anon, authenticated;

create or replace function public.assert_product_modifiers(p_product uuid, p_options jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  opt jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_id uuid;
  v_name text;
  v_price numeric;
  r record;
  v_picked integer;
begin
  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    p_options := '[]'::jsonb;
  end if;
  for opt in select * from jsonb_array_elements(p_options)
  loop
    v_id := nullif(opt->>'option_id', '')::uuid;
    select o.id, o.name, coalesce(o.extra_price, 0)
      into v_id, v_name, v_price
    from public.modifier_options o
    join public.product_modifier_groups pg
      on pg.group_id = o.group_id and pg.product_id = p_product
    where o.id = v_id;
    if not found then
      continue;
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_clean) already
      where (already.value->>'option_id')::uuid = v_id
    ) then
      continue;
    end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'option_id', v_id,
      'name', v_name,
      'extra_price', v_price
    ));
  end loop;

  for r in
    select g.id, g.name, g.min_select, g.max_select, g.required
    from public.modifier_groups g
    join public.product_modifier_groups pg on pg.group_id = g.id
    where pg.product_id = p_product
  loop
    select count(*) into v_picked
    from jsonb_array_elements(v_clean) m
    join public.modifier_options o on o.id = (m.value->>'option_id')::uuid
    where o.group_id = r.id;
    if v_picked < (case when r.required then greatest(r.min_select, 1) else r.min_select end) then
      raise exception 'faltan opciones en %', r.name;
    end if;
    if r.max_select is not null and v_picked > r.max_select then
      raise exception 'sobran opciones en %', r.name;
    end if;
  end loop;
  return v_clean;
end;
$$;

revoke all on function public.assert_product_modifiers(uuid, jsonb) from public;

create or replace function public.save_line_modifiers(
  p_order uuid,
  p_product uuid,
  p_notes text,
  p_options jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_product uuid;
  v_rid uuid;
  v_source text;
  v_line uuid;
  opt jsonb;
  r record;
begin
  select oi.id, oi.order_id, oi.product_id, o.restaurant_id, o.source
    into v_line, v_order, v_product, v_rid, v_source
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.order_id = p_order
    and oi.product_id = p_product
    and coalesce(oi.notes, '') = coalesce(nullif(trim(p_notes), ''), '');
  if v_order is null then raise exception 'linea no existe'; end if;
  if auth.uid() is null then
    if v_source not in ('web_menu', 'kiosko', 'tablet', 'mesero') then
      raise exception 'sin permiso';
    end if;
  elsif not public.is_member(v_rid) then
    raise exception 'sin permiso';
  end if;

  perform public.assert_product_modifiers(v_product, p_options);

  for opt in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  loop
    insert into public.order_item_modifiers (order_item_id, order_id, option_id, name, extra_price)
    select v_line, v_order, o.id, o.name, o.extra_price
    from public.modifier_options o
    join public.product_modifier_groups pg on pg.group_id = o.group_id and pg.product_id = v_product
    where o.id = nullif(opt->>'option_id', '')::uuid
      and not exists (
        select 1 from public.order_item_modifiers m
        where m.order_item_id = v_line and m.option_id = o.id
      );
  end loop;
end;
$$;

revoke all on function public.save_line_modifiers(uuid, uuid, text, jsonb) from public;
grant execute on function public.save_line_modifiers(uuid, uuid, text, jsonb) to anon, authenticated;

create or replace function public.get_table_menu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
  v_name text;
  v_number int;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  select name into v_name from public.restaurants where id = v.restaurant_id;
  select number into v_number from public.dining_tables where id = v.table_id;
  return jsonb_build_object(
    'restaurant', v_name,
    'number', v_number,
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price, 'image_url', p.image_url, 'category', c.name
      ) order by c.name, p.name)
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.restaurant_id = v.restaurant_id and p.active is true
    ), '[]'::jsonb),
    'modifiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', l.product_id,
        'group_id', g.id,
        'group', g.name,
        'min', g.min_select,
        'max', g.max_select,
        'required', g.required,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.extra_price)), '[]'::jsonb)
          from public.modifier_options o where o.group_id = g.id
        )
      ))
      from public.product_modifier_groups l
      join public.modifier_groups g on g.id = l.group_id
      where g.restaurant_id = v.restaurant_id
    ), '[]'::jsonb),
    'removable', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', rl.product_id,
        'ingredient_id', rl.ingredient_id,
        'name', i.name
      ) order by i.name)
      from public.recipe_lines rl
      join public.products p on p.id = rl.product_id
      join public.ingredients i on i.id = rl.ingredient_id
      where p.restaurant_id = v.restaurant_id
        and p.active is true
        and rl.is_removable is true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_table_bill(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name,
        'qty', oi.qty,
        'price', oi.unit_price,
        'status', oi.status,
        'notes', oi.notes
      ))
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = v.order_id and coalesce(oi.status, 'pendiente') <> 'cancelado'
    ), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status, 'items', r.items))
      from public.table_requests r
      where r.session_id = v.id and r.status = 'pendiente'
    ), '[]'::jsonb),
    'total', coalesce(public.order_subtotal(v.order_id), 0)
  );
end;
$$;

create or replace function public.place_table_order(p_token text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
  v_count int;
  row jsonb;
  v_product uuid;
  v_qty int;
  v_price numeric;
  v_notes text;
  v_auto boolean;
  v_id uuid;
  v_line uuid;
  v_mods jsonb;
  x jsonb;
  opt jsonb;
  v_clean jsonb := '[]'::jsonb;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'el pedido está vacío';
  end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'el pedido es demasiado grande'; end if;
  select count(*) into v_count from public.table_requests
  where session_id = v.id and created_at > now() - interval '1 minute';
  if v_count >= 6 then raise exception 'espera un momento antes de enviar otro pedido'; end if;

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

  select coalesce(qr_auto_accept, false) into v_auto
  from public.restaurant_profiles where restaurant_id = v.restaurant_id;

  insert into public.table_requests (session_id, restaurant_id, table_id, kind, items, status)
  values (v.id, v.restaurant_id, v.table_id, 'pedido', v_clean, case when v_auto then 'aceptado' else 'pendiente' end)
  returning id into v_id;

  if v_auto then
    for x in select * from jsonb_array_elements(v_clean)
    loop
      insert into public.order_items (order_id, product_id, qty, unit_price, status, notes)
      values (
        v.order_id,
        (x->>'product_id')::uuid,
        (x->>'qty')::int,
        (x->>'price')::numeric,
        'pendiente',
        nullif(x->>'notes', '')
      )
      on conflict (order_id, product_id, (coalesce(notes, ''))) do update
        set qty = public.order_items.qty + excluded.qty,
            status = case
              when public.order_items.status = 'cancelado' then 'pendiente'
              else public.order_items.status
            end
      returning id into v_line;

      for opt in select * from jsonb_array_elements(coalesce(x->'modifiers', '[]'::jsonb))
      loop
        insert into public.order_item_modifiers (order_item_id, order_id, option_id, name, extra_price)
        select v_line, v.order_id, (opt->>'option_id')::uuid, opt->>'name', coalesce((opt->>'extra_price')::numeric, 0)
        where not exists (
          select 1 from public.order_item_modifiers m
          where m.order_item_id = v_line and m.option_id = (opt->>'option_id')::uuid
        );
      end loop;
    end loop;
  end if;

  insert into public.action_log (restaurant_id, order_id, action, summary, detail)
  values (v.restaurant_id, v.order_id, 'mesa_qr', 'Pedido desde el celular', jsonb_build_object('request_id', v_id, 'auto', v_auto));

  return jsonb_build_object('id', v_id, 'accepted', v_auto);
end;
$$;

create or replace function public.review_table_request(p_id uuid, p_accept boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_requests;
  s public.table_sessions;
  x jsonb;
  opt jsonb;
  v_line uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select * into v from public.table_requests where id = p_id and status = 'pendiente';
  if v.id is null then raise exception 'ese aviso ya se atendió'; end if;
  if not public.is_member(v.restaurant_id) then raise exception 'sin permiso'; end if;
  if not p_accept then
    update public.table_requests set status = 'rechazado', reason = left(coalesce(p_reason, 'No se pudo'), 140) where id = p_id;
    insert into public.action_log (restaurant_id, actor, action, summary, detail)
    values (v.restaurant_id, auth.uid(), 'mesa_qr', 'Pedido del celular rechazado', jsonb_build_object('request_id', p_id, 'reason', p_reason));
    return;
  end if;
  select * into s from public.table_sessions where id = v.session_id and status = 'abierta';
  if v.kind = 'pedido' then
    if s.id is null then raise exception 'la mesa ya se cerró'; end if;
    for x in select * from jsonb_array_elements(coalesce(v.items, '[]'::jsonb))
    loop
      insert into public.order_items (order_id, product_id, qty, unit_price, status, notes)
      values (
        s.order_id,
        (x->>'product_id')::uuid,
        (x->>'qty')::int,
        (x->>'price')::numeric,
        'pendiente',
        nullif(x->>'notes', '')
      )
      on conflict (order_id, product_id, (coalesce(notes, ''))) do update
        set qty = public.order_items.qty + excluded.qty,
            status = case
              when public.order_items.status = 'cancelado' then 'pendiente'
              else public.order_items.status
            end
      returning id into v_line;

      for opt in select * from jsonb_array_elements(coalesce(x->'modifiers', '[]'::jsonb))
      loop
        insert into public.order_item_modifiers (order_item_id, order_id, option_id, name, extra_price)
        select v_line, s.order_id, (opt->>'option_id')::uuid, opt->>'name', coalesce((opt->>'extra_price')::numeric, 0)
        where (opt->>'option_id') is not null
          and not exists (
            select 1 from public.order_item_modifiers m
            where m.order_item_id = v_line and m.option_id = (opt->>'option_id')::uuid
          );
      end loop;
    end loop;
  end if;
  update public.table_requests set status = 'aceptado' where id = p_id;
  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (v.restaurant_id, s.order_id, auth.uid(), 'mesa_qr', 'Pedido del celular aceptado', jsonb_build_object('request_id', p_id));
end;
$$;

grant execute on function public.get_table_menu(text) to anon, authenticated;
grant execute on function public.get_table_bill(text) to anon, authenticated;
grant execute on function public.place_table_order(text, jsonb) to anon, authenticated;
grant execute on function public.review_table_request(uuid, boolean, text) to authenticated;
