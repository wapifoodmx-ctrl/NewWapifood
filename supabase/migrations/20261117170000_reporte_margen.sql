-- El margen del reporte sumaba el costo de una orden dentro de un agregado
-- sin agrupar. Postgres lo rechaza y el reporte de locales no abre.

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
  ),
  per_order as (
    select o.id,
           coalesce(o.charged_food, public.order_food_total(o.id)) as food,
           coalesce((select sum(l.qty * l.unit_cost) from lines l where l.order_id = o.id), 0) as cost
    from paid o
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
                 po.food,
                 po.cost
          from per_order po
          join paid o on o.id = po.id
          left join public.waiters w on w.id = o.waiter_id
        ) named
        group by waiter
      ) w
    ), '[]'::jsonb),
    'margin_estimate', coalesce((select round(sum(food - cost), 2) from per_order), 0)
  ) into v;
  return v;
end;
$$;

revoke all on function public.sales_report(uuid, date, date) from public, anon;
grant execute on function public.sales_report(uuid, date, date) to authenticated;
