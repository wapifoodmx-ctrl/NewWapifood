-- Costo promedio ponderado al comprar.
-- El margen de reportes es lo cobrado, ya con descuentos, menos el costo de la receta.
-- Si el platillo no tiene receta, se usa el costo del platillo. No se inventa otro costo.

create or replace function public.record_purchase(
  p_restaurant uuid,
  p_supplier uuid,
  p_note text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_total numeric(12,2) := 0;
  row jsonb;
  v_ing uuid;
  v_qty numeric;
  v_cost numeric;
  v_line numeric(12,2);
  v_stock numeric;
  v_old numeric;
  v_base numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  if p_supplier is not null and not exists (
    select 1 from public.suppliers where id = p_supplier and restaurant_id = p_restaurant
  ) then
    raise exception 'ese proveedor no es de este local';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'la compra necesita al menos un insumo';
  end if;

  insert into public.purchases (restaurant_id, supplier_id, note)
  values (p_restaurant, p_supplier, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  for row in select * from jsonb_array_elements(p_lines)
  loop
    v_ing := nullif(row->>'ingredient_id', '')::uuid;
    v_qty := (row->>'qty')::numeric;
    v_cost := coalesce((row->>'unit_cost')::numeric, 0);
    if v_qty is null or v_qty <= 0 then raise exception 'cantidad inválida'; end if;
    if v_cost < 0 then raise exception 'el costo no puede ser negativo'; end if;
    select stock, coalesce(cost, 0) into v_stock, v_old
    from public.ingredients
    where id = v_ing and restaurant_id = p_restaurant;
    if v_stock is null then raise exception 'ese insumo no es de este local'; end if;
    v_line := round(v_qty * v_cost, 2);
    insert into public.purchase_lines (purchase_id, ingredient_id, qty, unit_cost, line_total)
    values (v_id, v_ing, v_qty, v_cost, v_line);
    v_base := greatest(coalesce(v_stock, 0), 0);
    perform public.register_entrada(v_ing, v_qty, 'compra');
    update public.ingredients
      set cost = round((v_base * v_old + v_qty * v_cost) / (v_base + v_qty), 4)
    where id = v_ing;
    v_total := v_total + v_line;
  end loop;

  update public.purchases set total = v_total where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.record_purchase(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_purchase(uuid, uuid, text, jsonb) to authenticated;

create or replace function public.sales_report(p_restaurant uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'rango inválido'; end if;

  with paid as (
    select o.*
    from public.orders o
    where o.restaurant_id = p_restaurant
      and o.status = 'pagada'
      and (coalesce(o.closed_at, o.opened_at) at time zone 'America/Mexico_City')::date
          between p_from and p_to
  ),
  recipe_cost as (
    select rl.product_id, sum(rl.qty * coalesce(i.cost, 0)) as unit_cost
    from public.recipe_lines rl
    join public.ingredients i on i.id = rl.ingredient_id
    group by rl.product_id
  ),
  lines as (
    select oi.order_id, oi.qty, oi.unit_price, p.name,
           coalesce(rc.unit_cost, p.cost, 0) as unit_cost
    from public.order_items oi
    join paid o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    left join recipe_cost rc on rc.product_id = oi.product_id
    where coalesce(oi.status, 'pendiente') <> 'cancelado'
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'tickets', (select count(*) from paid),
    'food', coalesce((select round(sum(coalesce(charged_food, public.order_food_total(id))), 2) from paid), 0),
    'tips', coalesce((select round(sum(coalesce(tip_amount, 0)), 2) from paid), 0),
    'discounts', coalesce((select round(sum(coalesce(discount_amount, 0)), 2) from paid), 0),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'tickets', tickets, 'food', food, 'tips', tips) order by method)
      from (
        select coalesce(payment_method, method::text, 'sin_metodo') as method,
               count(*) as tickets,
               round(sum(coalesce(charged_food, public.order_food_total(id))), 2) as food,
               round(sum(coalesce(tip_amount, 0)), 2) as tips
        from paid
        group by 1
      ) m
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'food', food) order by food desc)
      from (
        select name, sum(qty) as qty, round(sum(unit_price * qty), 2) as food
        from lines
        group by name
        order by sum(unit_price * qty) desc
        limit 8
      ) t
    ), '[]'::jsonb),
    'by_waiter', coalesce((
      select jsonb_agg(jsonb_build_object('waiter', waiter, 'tickets', tickets, 'food', food, 'margin', margin) order by food desc)
      from (
        select waiter,
               count(*) as tickets,
               round(sum(food), 2) as food,
               round(sum(food - cost), 2) as margin
        from (
          select coalesce(w.name, 'Sin mesero') as waiter,
                 coalesce(o.charged_food, public.order_food_total(o.id)) as food,
                 coalesce((select sum(l.qty * l.unit_cost) from lines l where l.order_id = o.id), 0) as cost
          from paid o
          left join public.waiters w on w.id = o.waiter_id
        ) per_order
        group by waiter
      ) w
    ), '[]'::jsonb),
    'margin_estimate', coalesce((
      select round(sum(coalesce(o.charged_food, public.order_food_total(o.id))) - coalesce((
        select sum(l.qty * l.unit_cost) from lines l where l.order_id = o.id
      ), 0), 2)
      from paid o
    ), 0)
  ) into v;
  return v;
end;
$$;

revoke all on function public.sales_report(uuid, date, date) from public, anon;
grant execute on function public.sales_report(uuid, date, date) to authenticated;
