-- 026_propina_transparente.sql
-- Propina transparente: monto y método (efectivo entra al cajón, tarjeta solo se registra).

alter table public.orders
  add column if not exists tip_amount numeric(10,2) not null default 0,
  add column if not exists tip_method public.pay_method;

-- close_order ahora recibe p_tip y p_tip_method (opcionales, retrocompatibles).
create or replace function public.close_order(
  p_order uuid,
  p_method public.pay_method,
  p_cash numeric default null,
  p_tip numeric default 0,
  p_tip_method public.pay_method default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_need record;
  v_tip numeric := coalesce(p_tip, 0);
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'orden inexistente'; end if;
  if not public.has_role(v_order.restaurant_id, array['owner','admin','piso']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if v_order.stock_applied or v_order.status = 'pagada' then
    raise exception 'ya cobrada';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order) then
    raise exception 'cuenta vacia';
  end if;

  for v_need in
    select r.ingredient_id, sum(r.qty * oi.qty) as qty
    from public.order_items oi
    join public.recipe_lines r on r.product_id = oi.product_id
    where oi.order_id = p_order
    group by r.ingredient_id
  loop
    update public.ingredients
       set stock = stock - v_need.qty
     where id = v_need.ingredient_id
       and stock >= v_need.qty;
    if not found then
      raise exception 'stock insuficiente';
    end if;
    insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason)
    values (v_order.restaurant_id, v_need.ingredient_id, p_order, -v_need.qty, 'venta');
  end loop;

  update public.orders
     set status = 'pagada',
         method = p_method,
         closed_at = now(),
         stock_applied = true,
         tip_amount = v_tip,
         tip_method = coalesce(p_tip_method, p_method)
   where id = p_order;

  update public.dining_tables set state = 'libre' where id = v_order.table_id;
end;
$$;

revoke all on function public.close_order(uuid, public.pay_method, numeric, numeric, public.pay_method) from public;
grant execute on function public.close_order(uuid, public.pay_method, numeric, numeric, public.pay_method) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role[]) to authenticated;
