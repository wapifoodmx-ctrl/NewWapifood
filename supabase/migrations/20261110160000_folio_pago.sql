-- Folio opcional del cobro. Lo viejo en mp_payment_id se copia y no se borra.
-- transferencia y Mercado Pago se muestran como otro tipo de pago.

alter table public.order_payments add column if not exists folio text;
alter table public.orders add column if not exists folio text;

update public.order_payments
  set folio = mp_payment_id
where folio is null and nullif(trim(mp_payment_id), '') is not null;

update public.orders
  set folio = mp_payment_id
where folio is null and nullif(trim(mp_payment_id), '') is not null;

create index if not exists orders_folio_idx
  on public.orders (restaurant_id, folio);
create or replace function public.attach_ticket_payments(p_order uuid, p_payments jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_session uuid;
  row jsonb;
  v_cash numeric := 0;
  v_folio text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  for row in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    if coalesce((row->>'amount')::numeric, 0) <= 0 then continue; end if;
    v_folio := nullif(trim(coalesce(row->>'folio', row->>'mp_payment_id', '')), '');
    insert into public.order_payments (restaurant_id, order_id, method, amount, folio, mp_payment_id)
    values (
      v_rid,
      p_order,
      coalesce(row->>'method', 'efectivo'),
      round((row->>'amount')::numeric, 2),
      v_folio,
      v_folio
    );
    if coalesce(row->>'method', '') = 'efectivo' then
      v_cash := v_cash + round((row->>'amount')::numeric, 2);
    end if;
  end loop;

  update public.orders
    set folio = coalesce((
      select folio from public.order_payments
      where order_id = p_order and folio is not null
      order by created_at desc
      limit 1
    ), folio),
    mp_payment_id = coalesce((
      select folio from public.order_payments
      where order_id = p_order and folio is not null
      order by created_at desc
      limit 1
    ), mp_payment_id)
  where id = p_order;

  if v_cash > 0 and not exists (
    select 1 from public.cash_movements
    where order_id = p_order and kind = 'venta_efectivo'
  ) then
    select id into v_session from public.cash_sessions
    where restaurant_id = v_rid and status = 'open' limit 1;
    if v_session is not null then
      insert into public.cash_movements (session_id, restaurant_id, order_id, kind, amount, note)
      values (v_session, v_rid, p_order, 'venta_efectivo', v_cash, 'parte en efectivo');
    end if;
  end if;
end;
$$;

revoke all on function public.attach_ticket_payments(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.attach_ticket_payments(uuid, jsonb) to authenticated;

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
  if v_pay in ('transferencia', 'otro') then v_pay := 'mercadopago'; end if;
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
          || case when v_pay = 'mercadopago' then ' de otro tipo de pago' else ' de tarjeta' end
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
