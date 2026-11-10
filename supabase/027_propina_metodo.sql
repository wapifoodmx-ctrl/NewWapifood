-- 027_propina_metodo_transparente.sql
-- Unifica close_order: acepta p_tip_method (efectivo/tarjeta) y solo registra
-- la propina en el cajón cuando es en efectivo. En tarjeta solo se registra.

alter table public.orders
  add column if not exists tip_amount numeric(10,2) not null default 0,
  add column if not exists tip_method public.pay_method;

-- Elimina versiones anteriores para evitar sobrecarga (p_tip_method nuevo).
drop function if exists public.close_order(uuid, text, numeric, numeric);
drop function if exists public.close_order(uuid, public.pay_method, numeric, numeric, public.pay_method);
drop function if exists public.close_order(uuid, public.pay_method);

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
      join public.order_items oi on oi.order_id = x.order_id and oi.product_id = x.product_id
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

  -- Propina en efectivo entra al cajón; en tarjeta solo se registra.
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

revoke all on function public.close_order(uuid, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.close_order(uuid, text, numeric, numeric, text) to authenticated;
