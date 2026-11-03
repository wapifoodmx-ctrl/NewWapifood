-- ============================================================
-- Integración dictamen WapifoodFront → New
-- Descuentos POS, totales sin ítems cancelados, close_order robusto
-- ============================================================

-- Descuento a nivel orden (% o monto fijo)
alter table public.orders
  add column if not exists discount_type text,
  add column if not exists discount_value numeric default 0,
  add column if not exists discount_amount numeric default 0;

do $$ begin
  alter table public.orders drop constraint if exists orders_discount_type_check;
  alter table public.orders
    add constraint orders_discount_type_check
    check (discount_type is null or discount_type in ('porcentaje', 'monto'));
exception when others then null;
end $$;

-- Descuento por línea
alter table public.order_items
  add column if not exists discount_type text,
  add column if not exists discount_value numeric default 0;

do $$ begin
  alter table public.order_items drop constraint if exists order_items_discount_type_check;
  alter table public.order_items
    add constraint order_items_discount_type_check
    check (discount_type is null or discount_type in ('porcentaje', 'monto'));
exception when others then null;
end $$;

-- Helper: subtotal de una orden (ignora ítems cancelados)
create or replace function public.order_subtotal(p_order uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    greatest(0,
      (oi.unit_price * oi.qty)
      - case
          when oi.discount_type = 'porcentaje' then (oi.unit_price * oi.qty) * coalesce(oi.discount_value, 0) / 100
          when oi.discount_type = 'monto' then coalesce(oi.discount_value, 0)
          else 0
        end
    )
  ), 0)
  from public.order_items oi
  where oi.order_id = p_order
    and coalesce(oi.status, 'pendiente') <> 'cancelado';
$$;

-- Cierre de orden = Finalizado Front (stock por receta, libera mesa)
create or replace function public.close_order(
  p_order uuid,
  p_method text default 'efectivo'
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
  r record;
  v_need numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;

  select restaurant_id, status, table_id
    into v_rid, v_status, v_table
  from public.orders where id = p_order;

  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden ya cerrada'; end if;

  -- Descontar inventario SOLO al finalizar (process-order Front)
  for r in
    select rl.ingredient_id, sum(rl.qty * oi.qty) as need
    from public.order_items oi
    join public.recipe_lines rl on rl.product_id = oi.product_id
    where oi.order_id = p_order
      and coalesce(oi.status, 'pendiente') <> 'cancelado'
    group by rl.ingredient_id
  loop
    update public.ingredients
      set stock = greatest(0, stock - r.need)
    where id = r.ingredient_id and restaurant_id = v_rid;

    insert into public.stock_moves (ingredient_id, qty, reason)
    values (r.ingredient_id, -r.need, 'venta:' || p_order::text);
  end loop;

  update public.orders
    set status = 'pagada',
        closed_at = now(),
        payment_method = coalesce(nullif(trim(p_method), ''), 'efectivo')
  where id = p_order;

  if v_table is not null and not exists (
    select 1 from public.orders o
    where o.table_id = v_table and o.id <> p_order
      and o.status not in ('pagada', 'cancelada')
  ) then
    update public.dining_tables
      set state = 'libre'
    where id = v_table and state <> 'no_disponible';
  end if;
end;
$$;

revoke all on function public.close_order(uuid, text) from public;
grant execute on function public.close_order(uuid, text) to authenticated;

-- Asegurar payment_method column
alter table public.orders
  add column if not exists payment_method text;

-- Aplicar descuento de orden antes de cobrar (opcional)
create or replace function public.set_order_discount(
  p_order uuid,
  p_type text,
  p_value numeric
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

  v_sub := public.order_subtotal(p_order);
  if p_type is null or coalesce(p_value, 0) <= 0 then
    update public.orders
      set discount_type = null, discount_value = 0, discount_amount = 0
    where id = p_order;
    return;
  end if;

  if p_type = 'porcentaje' then
    v_amt := round(v_sub * p_value / 100.0, 2);
  else
    v_amt := least(v_sub, p_value);
  end if;

  update public.orders
    set discount_type = p_type,
        discount_value = p_value,
        discount_amount = v_amt
  where id = p_order;
end;
$$;

revoke all on function public.set_order_discount(uuid, text, numeric) from public;
grant execute on function public.set_order_discount(uuid, text, numeric) to authenticated;
