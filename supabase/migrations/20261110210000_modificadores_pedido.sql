-- Guarda los modificadores de una linea y revisa minimo, maximo y obligatorio.

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
    if v_source not in ('web_menu', 'kiosko', 'tablet') then
      raise exception 'sin permiso';
    end if;
  elsif not public.is_member(v_rid) then
    raise exception 'sin permiso';
  end if;

  for opt in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  loop
    insert into public.order_item_modifiers (order_item_id, order_id, option_id, name, extra_price)
    select v_line, v_order, o.id, o.name, o.extra_price
    from public.modifier_options o
    join public.product_modifier_groups pg on pg.group_id = o.group_id and pg.product_id = v_product
    where o.id = nullif(opt->>'option_id', '')::uuid;
  end loop;

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
    where pg.product_id = v_product
  loop
    if r.picked < (case when r.required then greatest(r.min_select, 1) else r.min_select end) then
      raise exception 'faltan opciones en %', r.name;
    end if;
    if r.picked > r.max_select then
      raise exception 'sobran opciones en %', r.name;
    end if;
  end loop;
end;
$$;

revoke all on function public.save_line_modifiers(uuid, uuid, text, jsonb) from public;
grant execute on function public.save_line_modifiers(uuid, uuid, text, jsonb) to anon, authenticated;
