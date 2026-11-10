-- Cada devolución guarda su fecha. El corte la toma de ese momento,
-- no del día en que se cobró la cuenta.
-- Las devoluciones viejas, sin fecha propia, quedan con la fecha del cobro.

alter table public.orders
  add column if not exists refunded_at timestamptz;

alter table public.order_items
  add column if not exists refunded_at timestamptz;

create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists order_refunds_restaurant_created_idx
  on public.order_refunds (restaurant_id, created_at);

alter table public.order_refunds enable row level security;

drop policy if exists order_refunds_select on public.order_refunds;
create policy order_refunds_select on public.order_refunds
  for select to authenticated
  using (public.is_member(restaurant_id));

revoke all on table public.order_refunds from public, anon, authenticated;
grant select on table public.order_refunds to authenticated;

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

  new.refunded_at := v_at;

  if tg_table_name = 'orders' then
    insert into public.order_refunds (restaurant_id, order_id, amount, created_at)
    values (new.restaurant_id, new.id, v_delta, v_at);
  else
    insert into public.order_refunds (restaurant_id, order_id, order_item_id, amount, created_at)
    select o.restaurant_id, new.order_id, new.id, v_delta, v_at
    from public.orders o
    where o.id = new.order_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_record_order_refund on public.orders;
create trigger trg_record_order_refund
  before insert or update of refunded_amount on public.orders
  for each row execute function public.record_refund_delta();

drop trigger if exists trg_record_item_refund on public.order_items;
create trigger trg_record_item_refund
  before insert or update of refunded_amount on public.order_items
  for each row execute function public.record_refund_delta();

insert into public.order_refunds (restaurant_id, order_id, amount, created_at)
select o.restaurant_id, o.id, o.refunded_amount, coalesce(o.closed_at, o.opened_at, now())
from public.orders o
where o.refunded_amount > 0
  and not exists (
    select 1 from public.order_refunds r
    where r.order_id = o.id and r.order_item_id is null
  );

insert into public.order_refunds (restaurant_id, order_id, order_item_id, amount, created_at)
select o.restaurant_id, oi.order_id, oi.id, oi.refunded_amount, coalesce(o.closed_at, o.opened_at, now())
from public.order_items oi
join public.orders o on o.id = oi.order_id
where oi.refunded_amount > 0
  and not exists (
    select 1 from public.order_refunds r
    where r.order_item_id = oi.id
  );

update public.orders
set refunded_at = coalesce(closed_at, opened_at, now())
where refunded_amount > 0
  and refunded_at is null;

update public.order_items oi
set refunded_at = coalesce(o.closed_at, o.opened_at, now())
from public.orders o
where o.id = oi.order_id
  and oi.refunded_amount > 0
  and oi.refunded_at is null;

create or replace function public.cash_session_report(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_open timestamptz;
  v_until timestamptz;
  v_status text;
  v_float numeric;
  v jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, opened_at, coalesce(closed_at, now()), status, opening_float
    into v_rid, v_open, v_until, v_status, v_float
  from public.cash_sessions
  where id = p_session;
  if v_rid is null then raise exception 'turno no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  with paid as (
    select
      coalesce(nullif(o.payment_method, ''), o.method::text, 'sin_metodo') as method,
      coalesce(o.charged_food, 0) as food,
      coalesce(o.tip_amount, 0) as tips,
      coalesce(o.discount_amount, 0) as discounts
    from public.orders o
    where o.restaurant_id = v_rid
      and o.status = 'pagada'
      and coalesce(o.closed_at, o.opened_at) >= v_open
      and coalesce(o.closed_at, o.opened_at) <= v_until
  ),
  refunds as (
    select
      coalesce(nullif(o.payment_method, ''), o.method::text, 'sin_metodo') as method,
      r.amount
    from public.order_refunds r
    join public.orders o on o.id = r.order_id
    where r.restaurant_id = v_rid
      and r.created_at >= v_open
      and r.created_at <= v_until
  ),
  cancelled as (
    select count(*) as tickets
    from public.orders o
    where o.restaurant_id = v_rid
      and o.status = 'cancelada'
      and coalesce(o.closed_at, o.opened_at) >= v_open
      and coalesce(o.closed_at, o.opened_at) <= v_until
  )
  select jsonb_build_object(
    'session_id', p_session,
    'opened_at', v_open,
    'until', v_until,
    'status', v_status,
    'opening_float', v_float,
    'expected_cash', public.cash_expected(p_session),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', m.kind,
        'amount', m.amount,
        'note', m.note,
        'created_at', m.created_at
      ) order by m.created_at)
      from public.cash_movements m
      where m.session_id = p_session
    ), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object(
        'method', method,
        'tickets', tickets,
        'food', food,
        'tips', tips,
        'discounts', discounts,
        'refunds', refunds
      ) order by method)
      from (
        select method,
               sum(tickets) as tickets,
               round(sum(food), 2) as food,
               round(sum(tips), 2) as tips,
               round(sum(discounts), 2) as discounts,
               round(sum(refunds), 2) as refunds
        from (
          select method, count(*)::numeric as tickets, sum(food) as food, sum(tips) as tips, sum(discounts) as discounts, 0::numeric as refunds
          from paid
          group by method
          union all
          select method, 0::numeric, 0::numeric, 0::numeric, 0::numeric, sum(amount)
          from refunds
          group by method
        ) parts
        group by method
      ) g
    ), '[]'::jsonb),
    'tickets', coalesce((select count(*) from paid), 0),
    'food', coalesce((select round(sum(food), 2) from paid), 0),
    'tips', coalesce((select round(sum(tips), 2) from paid), 0),
    'discounts', coalesce((select round(sum(discounts), 2) from paid), 0),
    'refunds', coalesce((select round(sum(amount), 2) from refunds), 0),
    'cancellations', coalesce((select tickets from cancelled), 0)
  ) into v;

  return v;
end;
$$;

revoke all on function public.record_refund_delta() from public, anon, authenticated;
revoke all on function public.cash_session_report(uuid) from public, anon;
grant execute on function public.cash_session_report(uuid) to authenticated;
