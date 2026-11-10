-- Propinas sugeridas y reparto. No reparte por horas: no hay checador.
-- El efectivo de la propina sigue entrando al cajón como ya lo hace el cobro.

alter table public.restaurant_profiles
  add column if not exists tips_enabled boolean not null default true;

alter table public.restaurant_profiles
  add column if not exists tip_rates text not null default '10,15,20';

create table if not exists public.tip_payouts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  mode text not null check (mode in ('individual', 'iguales', 'porcentaje')),
  total numeric(10,2) not null default 0,
  shares jsonb not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists tip_payouts_restaurant_idx
  on public.tip_payouts (restaurant_id, created_at desc);

alter table public.tip_payouts enable row level security;

drop policy if exists tip_payouts_select on public.tip_payouts;
create policy tip_payouts_select on public.tip_payouts
  for select to authenticated
  using (public.is_member(restaurant_id));

revoke all on table public.tip_payouts from public, anon, authenticated;
grant select on table public.tip_payouts to authenticated;

create or replace function public.tip_report(
  p_restaurant uuid,
  p_from date,
  p_to date
)
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

  with tips as (
    select
      o.id,
      coalesce(o.tip_amount, 0) as tip,
      coalesce(o.tip_method::text, o.method::text, 'sin_metodo') as method,
      o.waiter_id,
      coalesce(w.name, 'Sin mesero') as waiter,
      (coalesce(o.closed_at, o.opened_at) at time zone 'America/Mexico_City')::date as day
    from public.orders o
    left join public.waiters w on w.id = o.waiter_id
    where o.restaurant_id = p_restaurant
      and o.status = 'pagada'
      and coalesce(o.tip_amount, 0) > 0
      and (coalesce(o.closed_at, o.opened_at) at time zone 'America/Mexico_City')::date between p_from and p_to
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'total', coalesce((select round(sum(tip), 2) from tips), 0),
    'tickets', coalesce((select count(*) from tips), 0),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'amount', amount) order by method)
      from (select method, round(sum(tip), 2) as amount from tips group by method) m
    ), '[]'::jsonb),
    'by_waiter', coalesce((
      select jsonb_agg(jsonb_build_object('waiter_id', waiter_id, 'waiter', waiter, 'amount', amount, 'tickets', tickets) order by amount desc)
      from (
        select waiter_id, waiter, round(sum(tip), 2) as amount, count(*) as tickets
        from tips group by waiter_id, waiter
      ) w
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'amount', amount) order by day)
      from (select day, round(sum(tip), 2) as amount from tips group by day) d
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.close_tip_payout(
  p_restaurant uuid,
  p_from date,
  p_to date,
  p_mode text,
  p_shares jsonb default '[]'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_report jsonb;
  v_total numeric;
  v_count integer;
  v_sum numeric;
  v_shares jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.has_role(p_restaurant, array['owner', 'admin']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if p_mode not in ('individual', 'iguales', 'porcentaje') then
    raise exception 'ese reparto no está listo. Por horas falta el checador.';
  end if;

  v_report := public.tip_report(p_restaurant, p_from, p_to);
  v_total := coalesce((v_report->>'total')::numeric, 0);

  if p_mode = 'individual' then
    v_shares := coalesce(v_report->'by_waiter', '[]'::jsonb);
  elsif p_mode = 'iguales' then
    select count(*) into v_count from jsonb_array_elements(coalesce(v_report->'by_waiter', '[]'::jsonb));
    if v_count = 0 then
      v_shares := '[]'::jsonb;
    else
      select jsonb_agg(jsonb_build_object(
        'waiter_id', x->>'waiter_id',
        'waiter', x->>'waiter',
        'amount', round(v_total / v_count, 2)
      ))
      into v_shares
      from jsonb_array_elements(v_report->'by_waiter') x;
    end if;
  else
    select coalesce(sum((x->>'percent')::numeric), 0) into v_sum
    from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) x;
    if abs(v_sum - 100) > 0.05 then
      raise exception 'los porcentajes deben sumar 100';
    end if;
    select jsonb_agg(jsonb_build_object(
      'waiter_id', x->>'waiter_id',
      'waiter', x->>'waiter',
      'percent', (x->>'percent')::numeric,
      'amount', round(v_total * (x->>'percent')::numeric / 100, 2)
    ))
    into v_shares
    from jsonb_array_elements(p_shares) x;
  end if;

  insert into public.tip_payouts (restaurant_id, period_from, period_to, mode, total, shares, notes, created_by)
  values (p_restaurant, p_from, p_to, p_mode, v_total, coalesce(v_shares, '[]'::jsonb), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.tip_report(uuid, date, date) from public, anon, authenticated;
revoke all on function public.close_tip_payout(uuid, date, date, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.tip_report(uuid, date, date) to authenticated;
grant execute on function public.close_tip_payout(uuid, date, date, text, jsonb, text) to authenticated;
