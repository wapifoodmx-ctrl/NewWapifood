-- Corte parcial (no cierra) y corte del día (cierra).
-- No cambia close_order: se puede cobrar con la caja cerrada.
-- Aditiva: no borra filas ni columnas.

create table if not exists public.cash_cuts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.cash_sessions(id) on delete cascade,
  kind text not null check (kind in ('parcial', 'dia')),
  created_at timestamptz not null default now(),
  created_by uuid,
  notes text,
  snapshot jsonb not null
);

create index if not exists cash_cuts_restaurant_id_idx
  on public.cash_cuts (restaurant_id, created_at desc);

alter table public.cash_cuts enable row level security;

drop policy if exists cash_cuts_member on public.cash_cuts;
create policy cash_cuts_member on public.cash_cuts
  for select to authenticated
  using (public.is_member(restaurant_id));

revoke all on table public.cash_cuts from public, anon, authenticated;
grant select on table public.cash_cuts to authenticated;

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
      coalesce(o.discount_amount, 0) as discounts,
      coalesce(o.refunded_amount, 0) as refunds
    from public.orders o
    where o.restaurant_id = v_rid
      and o.status = 'pagada'
      and coalesce(o.closed_at, o.opened_at) >= v_open
      and coalesce(o.closed_at, o.opened_at) <= v_until
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
               count(*) as tickets,
               round(sum(food), 2) as food,
               round(sum(tips), 2) as tips,
               round(sum(discounts), 2) as discounts,
               round(sum(refunds), 2) as refunds
        from paid
        group by method
      ) g
    ), '[]'::jsonb),
    'tickets', coalesce((select count(*) from paid), 0),
    'food', coalesce((select round(sum(food), 2) from paid), 0),
    'tips', coalesce((select round(sum(tips), 2) from paid), 0),
    'discounts', coalesce((select round(sum(discounts), 2) from paid), 0),
    'refunds', coalesce((select round(sum(refunds), 2) from paid), 0),
    'cancellations', coalesce((select tickets from cancelled), 0)
  ) into v;

  return v;
end;
$$;

create or replace function public.save_partial_cut(
  p_session uuid,
  p_counted jsonb default '{}'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
  v_id uuid;
  v_snap jsonb;
  v_counted jsonb := coalesce(p_counted, '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if jsonb_typeof(v_counted) is distinct from 'object' then
    raise exception 'el conteo no es válido';
  end if;
  select restaurant_id, status into v_rid, v_status
  from public.cash_sessions where id = p_session;
  if v_rid is null then raise exception 'turno no existe'; end if;
  if not public.has_role(v_rid, array['owner', 'admin', 'piso']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if v_status <> 'open' then raise exception 'el turno ya está cerrado'; end if;

  v_snap := public.cash_session_report(p_session)
    || jsonb_build_object('counted', v_counted, 'kind', 'parcial');

  insert into public.cash_cuts (restaurant_id, session_id, kind, created_by, notes, snapshot)
  values (v_rid, p_session, 'parcial', auth.uid(), nullif(trim(p_notes), ''), v_snap)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.close_cash_day(
  p_session uuid,
  p_counted_cash numeric,
  p_counted jsonb default '{}'::jsonb,
  p_notes text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
  v_diff numeric;
  v_counted jsonb := coalesce(p_counted, '{}'::jsonb);
  v_snap jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if jsonb_typeof(v_counted) is distinct from 'object' then
    raise exception 'el conteo no es válido';
  end if;
  select restaurant_id, status into v_rid, v_status
  from public.cash_sessions where id = p_session;
  if v_rid is null then raise exception 'turno no existe'; end if;
  if not public.has_role(v_rid, array['owner', 'admin', 'piso']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if v_status <> 'open' then raise exception 'el turno ya está cerrado'; end if;

  v_diff := public.close_cash_session(p_session, p_counted_cash, p_notes);
  v_snap := public.cash_session_report(p_session)
    || jsonb_build_object(
      'counted', v_counted || jsonb_build_object('efectivo', round(p_counted_cash, 2)),
      'kind', 'dia',
      'difference_cash', v_diff
    );

  insert into public.cash_cuts (restaurant_id, session_id, kind, created_by, notes, snapshot)
  values (v_rid, p_session, 'dia', auth.uid(), nullif(trim(p_notes), ''), v_snap);
  return v_diff;
end;
$$;

revoke all on function public.cash_session_report(uuid) from public, anon, authenticated;
revoke all on function public.save_partial_cut(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.close_cash_day(uuid, numeric, jsonb, text) from public, anon, authenticated;

grant execute on function public.cash_session_report(uuid) to authenticated;
grant execute on function public.save_partial_cut(uuid, jsonb, text) to authenticated;
grant execute on function public.close_cash_day(uuid, numeric, jsonb, text) to authenticated;
