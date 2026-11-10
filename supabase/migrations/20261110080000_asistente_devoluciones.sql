-- Asistente de cancelación y devolución. No cambia el descuento de inventario al cobrar.
-- Efectivo sale del cajón si hay caja abierta y entra al corte por su fecha.
-- Tarjeta y Mercado Pago quedan pendientes. No hay reembolso por la API de MP.

alter table public.restaurant_profiles
  add column if not exists manager_pin text;

alter table public.order_items
  add column if not exists resolved_qty integer not null default 0;

alter table public.order_refunds
  add column if not exists method text;

alter table public.order_refunds
  add column if not exists status text not null default 'hecho';

alter table public.order_refunds
  add column if not exists note text;

alter table public.order_refunds
  drop constraint if exists order_refunds_status_check;

alter table public.order_refunds
  add constraint order_refunds_status_check check (status in ('hecho', 'pendiente'));

create table if not exists public.action_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  actor uuid,
  action text not null,
  summary text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists action_log_restaurant_created_idx
  on public.action_log (restaurant_id, created_at desc);

alter table public.action_log enable row level security;

drop policy if exists action_log_select on public.action_log;
create policy action_log_select on public.action_log
  for select to authenticated
  using (public.is_member(restaurant_id));

revoke all on table public.action_log from public, anon, authenticated;
grant select on table public.action_log to authenticated;

create or replace function public.record_refund_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric;
  v_at timestamptz := now();
begin
  if tg_op = 'INSERT' then
    v_delta := round(coalesce(new.refunded_amount, 0), 2);
  else
    v_delta := round(coalesce(new.refunded_amount, 0) - coalesce(old.refunded_amount, 0), 2);
  end if;
  if v_delta <= 0 then
    return new;
  end if;
  new.refunded_at := coalesce(new.refunded_at, v_at);
  if current_setting('wapifood.skip_refund_log', true) = '1' then
    return new;
  end if;
  if tg_table_name = 'orders' then
    insert into public.order_refunds (restaurant_id, order_id, amount, created_at)
    values (new.restaurant_id, new.id, v_delta, new.refunded_at);
  else
    insert into public.order_refunds (restaurant_id, order_id, order_item_id, amount, created_at)
    select o.restaurant_id, new.order_id, new.id, v_delta, new.refunded_at
    from public.orders o
    where o.id = new.order_id;
  end if;
  return new;
end;
$$;

create or replace function public.apply_order_fix(
  p_order uuid,
  p_payload jsonb,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rid uuid;
  v_status text;
  v_method text;
  v_applied boolean;
  v_charged numeric;
  v_tip numeric;
  v_already numeric;
  v_max numeric;
  v_amount numeric := 0;
  v_pin text;
  v_what text;
  v_money text;
  v_pay text;
  v_session uuid;
  item jsonb;
  v_product uuid;
  v_qty integer;
  v_left integer;
  v_item_qty integer;
  v_name text;
  v_stock text;
  v_summary text := '';
  v_stock_bits text := '';
  v_money_bit text := '';
  r record;
  v_need numeric;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select restaurant_id, status::text, method::text, coalesce(stock_applied, false),
         coalesce(charged_food, 0), coalesce(tip_amount, 0), coalesce(refunded_amount, 0)
    into v_rid, v_status, v_method, v_applied, v_charged, v_tip, v_already
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status = 'cancelada' then raise exception 'esta cuenta ya está cancelada'; end if;

  select nullif(trim(manager_pin), '') into v_pin
  from public.restaurant_profiles where restaurant_id = v_rid;
  if v_pin is not null and v_pin is distinct from nullif(trim(coalesce(p_pin, '')), '') then
    raise exception 'PIN de gerente incorrecto';
  end if;

  v_what := coalesce(p_payload->>'what', '');
  v_money := coalesce(p_payload->>'money', 'nada');
  v_pay := coalesce(p_payload->>'pay', v_method, 'efectivo');
  if v_what not in ('cancelar', 'quitar', 'dinero') then
    raise exception 'elige qué pasó';
  end if;
  if v_money not in ('nada', 'parcial', 'total') then
    raise exception 'elige qué pasa con el dinero';
  end if;
  if v_pay not in ('efectivo', 'tarjeta', 'mercadopago') then
    raise exception 'elige cómo se devuelve el dinero';
  end if;

  if v_what = 'cancelar' and v_status <> 'pagada' then
    perform public.cancel_order(p_order, 'cancelada con el asistente');
    v_summary := 'Se canceló toda la cuenta. No se devolvió dinero porque todavía no se había cobrado.';
  else
    if v_what = 'cancelar' and v_status = 'pagada' then
      v_what := 'quitar';
      p_payload := p_payload || jsonb_build_object('items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'product_id', oi.product_id,
          'qty', greatest(oi.qty - coalesce(oi.resolved_qty, 0), 0),
          'stock', coalesce(nullif(p_payload->>'stock_all', ''), 'merma')
        )), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = p_order and coalesce(oi.status, '') <> 'cancelado'
      ));
      if v_money = 'nada' then
        v_money := 'total';
      end if;
    end if;

    if v_what in ('quitar', 'cancelar') then
      for item in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
      loop
        v_product := (item->>'product_id')::uuid;
        v_qty := coalesce((item->>'qty')::integer, 0);
        v_stock := coalesce(item->>'stock', 'merma');
        if v_qty <= 0 then continue; end if;
        if v_stock not in ('regresar', 'merma') then raise exception 'elige inventario o merma'; end if;
        select qty, coalesce(resolved_qty, 0), name
          into v_item_qty, v_left, v_name
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = p_order and oi.product_id = v_product;
        if v_item_qty is null then raise exception 'ese platillo no está en la cuenta'; end if;
        v_left := v_item_qty - v_left;
        if v_qty > v_left then raise exception 'no hay tantas piezas de %', v_name; end if;

        if v_status = 'pagada' and v_applied then
          for r in
            select rl.ingredient_id, (rl.qty * v_qty) as need
            from public.recipe_lines rl
            where rl.product_id = v_product
            union all
            select x.ingredient_id, (x.qty * v_qty) as need
            from public.order_item_extras x
            where x.order_id = p_order and x.product_id = v_product
          loop
            v_need := r.need;
            if v_stock = 'regresar' then
              update public.ingredients
                set stock = stock + v_need
              where id = r.ingredient_id and restaurant_id = v_rid;
              insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
              values (v_rid, r.ingredient_id, p_order, v_need, 'ajuste', 'regresa al inventario');
            else
              insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
              values (v_rid, r.ingredient_id, p_order, 0, 'merma', 'se pierde');
            end if;
          end loop;
          update public.order_items
            set resolved_qty = coalesce(resolved_qty, 0) + v_qty,
                status = case when coalesce(resolved_qty, 0) + v_qty >= qty then 'cancelado' else status end,
                stock_resolution = case
                  when coalesce(resolved_qty, 0) + v_qty >= qty and v_stock = 'regresar' then 'devuelto'
                  when coalesce(resolved_qty, 0) + v_qty >= qty then 'merma'
                  else stock_resolution
                end
          where order_id = p_order and product_id = v_product;
        else
          if v_qty >= v_item_qty then
            update public.order_items set status = 'cancelado' where order_id = p_order and product_id = v_product;
          else
            update public.order_items set qty = qty - v_qty where order_id = p_order and product_id = v_product;
          end if;
        end if;

        v_stock_bits := v_stock_bits || case when v_stock_bits = '' then '' else '. ' end
          || v_qty || ' ' || v_name || case when v_stock = 'regresar' then ' regresan al inventario' else ' se pierden' end;
      end loop;
    end if;

    if v_status = 'pagada' and v_charged = 0 then
      select coalesce(sum(unit_price * qty), 0) into v_charged
      from public.order_items where order_id = p_order;
    end if;
    select coalesce(sum(refunded_amount), 0) into v_already
    from (
      select refunded_amount from public.orders where id = p_order
      union all
      select refunded_amount from public.order_items where order_id = p_order
    ) x;
    v_max := round(greatest(v_charged + v_tip - v_already, 0), 2);
    if v_status = 'pagada' and v_money <> 'nada' then
      if v_money = 'total' then
        v_amount := v_max;
      else
        v_amount := round(coalesce((p_payload->>'amount')::numeric, 0), 2);
      end if;
      if v_amount <= 0 then raise exception 'escribe cuánto dinero se devuelve'; end if;
      if v_amount > v_max + 0.001 then raise exception 'no se puede devolver más de lo cobrado'; end if;

      perform set_config('wapifood.skip_refund_log', '1', true);
      update public.orders
        set refunded_amount = round(refunded_amount + v_amount, 2),
            refunded_at = now()
      where id = p_order;
      insert into public.order_refunds (restaurant_id, order_id, amount, method, status, note, created_at)
      values (
        v_rid, p_order, v_amount, v_pay,
        case when v_pay = 'efectivo' then 'hecho' else 'pendiente' end,
        'asistente', now()
      );

      if v_pay = 'efectivo' then
        select id into v_session from public.cash_sessions
        where restaurant_id = v_rid and status = 'open' limit 1;
        if v_session is not null then
          insert into public.cash_movements (session_id, restaurant_id, order_id, kind, amount, note)
          values (v_session, v_rid, p_order, 'salida', v_amount, 'devolución en efectivo');
          v_money_bit := 'Se devuelven ' || v_amount || ' en efectivo. Salen del cajón y entran al corte de hoy.';
        else
          v_money_bit := 'Se anotan ' || v_amount || ' en efectivo. No hay caja abierta, así que no salieron del cajón.';
        end if;
      else
        v_money_bit := 'Se anotan ' || v_amount || ' como devolución pendiente'
          || case when v_pay = 'mercadopago' then ' de Mercado Pago' else ' de tarjeta' end
          || '. No se hizo el reembolso en el banco.';
      end if;
    elsif v_money <> 'nada' then
      v_money_bit := 'No se devolvió dinero porque la cuenta no está cobrada.';
    else
      v_money_bit := 'No se devuelve dinero.';
    end if;

    v_summary := trim(both ' ' from concat_ws(' ', nullif(v_stock_bits, ''), v_money_bit));
    if v_summary = '' then
      v_summary := 'No hubo cambios.';
    end if;
  end if;

  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (v_rid, p_order, v_uid, 'asistente', v_summary, p_payload || jsonb_build_object('amount', v_amount, 'pay', v_pay));

  return jsonb_build_object('summary', v_summary, 'amount', v_amount, 'pay', v_pay);
end;
$$;

revoke all on function public.apply_order_fix(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_order_fix(uuid, jsonb, text) to authenticated;
