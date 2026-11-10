-- PIN de gerente para anular y descontar. Si el local no lo configuró, no se pide.
-- La firma gana un argumento opcional al final. Las llamadas viejas siguen valiendo.

create or replace function public.assert_manager_pin(p_restaurant uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  select nullif(trim(manager_pin), '') into v_pin
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;
  if v_pin is null then
    return;
  end if;
  if v_pin is distinct from nullif(trim(coalesce(p_pin, '')), '') then
    raise exception 'PIN de gerente incorrecto';
  end if;
end;
$$;

drop function if exists public.cancel_order(uuid, text);

create or replace function public.cancel_order(
  p_order uuid,
  p_reason text default 'cancelada por el local',
  p_pin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_table uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, table_id, status::text into v_rid, v_table, v_status
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'la orden ya está cerrada'; end if;
  perform public.assert_manager_pin(v_rid, p_pin);
  update public.orders
    set status = 'cancelada'::public.order_status,
        cancel_reason = coalesce(nullif(trim(p_reason), ''), 'cancelada por el local'),
        closed_at = now()
  where id = p_order;
  if v_table is not null and not exists (
    select 1 from public.orders o
    where o.table_id = v_table and o.id <> p_order
      and o.status::text not in ('pagada', 'cancelada')
  ) and (select state::text from public.dining_tables where id = v_table) is distinct from 'no_disponible' then
    update public.dining_tables set state = 'libre'::public.table_state where id = v_table;
  end if;
  insert into public.action_log (restaurant_id, order_id, actor, action, summary)
  values (v_rid, p_order, auth.uid(), 'cancelar', coalesce(nullif(trim(p_reason), ''), 'Cuenta cancelada'));
end;
$$;

drop function if exists public.set_order_discount(uuid, text, numeric);

create or replace function public.set_order_discount(
  p_order uuid,
  p_type text,
  p_value numeric,
  p_pin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_sub numeric;
  v_amt numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_type is not null and p_type not in ('porcentaje', 'monto') then
    raise exception 'tipo descuento inválido';
  end if;
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if p_type is not null and coalesce(p_value, 0) > 0 then
    perform public.assert_manager_pin(v_rid, p_pin);
  end if;
  v_sub := public.order_subtotal(p_order);
  if p_type is null or coalesce(p_value, 0) <= 0 then
    update public.orders set discount_type = null, discount_value = 0, discount_amount = 0 where id = p_order;
    return;
  end if;
  if p_type = 'porcentaje' then
    v_amt := round(v_sub * p_value / 100.0, 2);
  else
    v_amt := least(v_sub, p_value);
  end if;
  update public.orders
    set discount_type = p_type, discount_value = p_value, discount_amount = v_amt
  where id = p_order;
  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (v_rid, p_order, auth.uid(), 'descuento', 'Descuento en la cuenta', jsonb_build_object('type', p_type, 'value', p_value, 'amount', v_amt));
end;
$$;

drop function if exists public.set_item_discount(uuid, uuid, text, numeric);

create or replace function public.set_item_discount(
  p_order uuid,
  p_product uuid,
  p_type text,
  p_value numeric,
  p_pin text default null
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
    where order_id = p_order and product_id = p_product;
  else
    update public.order_items
      set discount_type = p_type, discount_value = round(p_value, 2)
    where order_id = p_order and product_id = p_product;
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
    values (v_rid, p_order, auth.uid(), 'descuento', 'Descuento en un platillo', jsonb_build_object('product_id', p_product, 'type', p_type, 'value', p_value));
  end if;
end;
$$;

revoke all on function public.assert_manager_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_order_discount(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.set_item_discount(uuid, uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.cancel_order(uuid, text, text) to authenticated;
grant execute on function public.set_order_discount(uuid, text, numeric, text) to authenticated;
grant execute on function public.set_item_discount(uuid, uuid, text, numeric, text) to authenticated;
