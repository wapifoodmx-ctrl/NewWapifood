-- Varios métodos en un ticket y el id de Mercado Pago, para un reembolso futuro.
-- No cambia close_order. El efectivo que no entró al cajón se anota si hay caja abierta.

alter table public.orders
  add column if not exists mp_payment_id text;

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null,
  amount numeric(10,2) not null check (amount > 0),
  mp_payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists order_payments_order_idx
  on public.order_payments (order_id);

alter table public.order_payments enable row level security;

drop policy if exists order_payments_select on public.order_payments;
create policy order_payments_select on public.order_payments
  for select to authenticated
  using (public.is_member(restaurant_id));

revoke all on table public.order_payments from public, anon, authenticated;
grant select on table public.order_payments to authenticated;

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
  v_mp text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  for row in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    if coalesce((row->>'amount')::numeric, 0) <= 0 then continue; end if;
    insert into public.order_payments (restaurant_id, order_id, method, amount, mp_payment_id)
    values (
      v_rid,
      p_order,
      coalesce(row->>'method', 'efectivo'),
      round((row->>'amount')::numeric, 2),
      nullif(trim(coalesce(row->>'mp_payment_id', '')), '')
    );
    if coalesce(row->>'method', '') = 'efectivo' then
      v_cash := v_cash + round((row->>'amount')::numeric, 2);
    end if;
    if nullif(trim(coalesce(row->>'mp_payment_id', '')), '') is not null then
      v_mp := nullif(trim(row->>'mp_payment_id'), '');
    end if;
  end loop;

  if v_mp is not null then
    update public.orders set mp_payment_id = v_mp where id = p_order;
  end if;

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
