-- Checador de entrada y salida. El reparto por horas usa estas marcas.
-- No inventa horas si nadie checó.

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  waiter_id uuid not null references public.waiters(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text
);

create index if not exists staff_shifts_open_idx
  on public.staff_shifts (restaurant_id, waiter_id)
  where ended_at is null;

create index if not exists staff_shifts_started_idx
  on public.staff_shifts (restaurant_id, started_at);

alter table public.staff_shifts enable row level security;

drop policy if exists staff_shifts_select on public.staff_shifts;
create policy staff_shifts_select on public.staff_shifts
  for select to authenticated
  using (public.is_member(restaurant_id));

revoke all on table public.staff_shifts from public, anon, authenticated;
grant select on table public.staff_shifts to authenticated;

create or replace function public.clock_in(p_restaurant uuid, p_waiter uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  if not exists (
    select 1 from public.waiters
    where id = p_waiter and restaurant_id = p_restaurant and active is true
  ) then
    raise exception 'ese mesero no está activo';
  end if;
  if exists (
    select 1 from public.staff_shifts
    where waiter_id = p_waiter and ended_at is null
  ) then
    raise exception 'ya tiene una entrada abierta';
  end if;
  insert into public.staff_shifts (restaurant_id, waiter_id)
  values (p_restaurant, p_waiter)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.clock_out(p_waiter uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id into v_rid from public.waiters where id = p_waiter;
  if v_rid is null then raise exception 'mesero no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  update public.staff_shifts
    set ended_at = now()
  where waiter_id = p_waiter and ended_at is null;
  if not found then raise exception 'no tiene una entrada abierta'; end if;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.tip_payouts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%mode%'
  loop
    execute format('alter table public.tip_payouts drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.tip_payouts
  drop constraint if exists tip_payouts_mode_check;

alter table public.tip_payouts
  add constraint tip_payouts_mode_check
  check (mode in ('individual', 'iguales', 'porcentaje', 'horas'));

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
  v_hours numeric;
  v_shares jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_assigned numeric := 0;
  v_row record;
  v_part numeric;
  v_last uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.has_role(p_restaurant, array['owner', 'admin']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if p_mode not in ('individual', 'iguales', 'porcentaje', 'horas') then
    raise exception 'elige un tipo de reparto';
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
  elsif p_mode = 'porcentaje' then
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
  else
    v_start := (p_from::timestamp) at time zone 'America/Mexico_City';
    v_end := ((p_to + 1)::timestamp) at time zone 'America/Mexico_City';
    select coalesce(sum(
      extract(epoch from (
        least(coalesce(s.ended_at, now()), v_end) - greatest(s.started_at, v_start)
      )) / 3600
    ), 0)
    into v_hours
    from public.staff_shifts s
    where s.restaurant_id = p_restaurant
      and s.started_at < v_end
      and coalesce(s.ended_at, now()) > v_start;
    if v_hours <= 0 then
      raise exception 'nadie checó entrada en esas fechas';
    end if;
    v_shares := '[]'::jsonb;
    for v_row in
      select w.id as waiter_id, w.name as waiter,
        sum(extract(epoch from (
          least(coalesce(s.ended_at, now()), v_end) - greatest(s.started_at, v_start)
        )) / 3600) as hours
      from public.staff_shifts s
      join public.waiters w on w.id = s.waiter_id
      where s.restaurant_id = p_restaurant
        and s.started_at < v_end
        and coalesce(s.ended_at, now()) > v_start
      group by w.id, w.name
      order by w.name
    loop
      v_part := round(v_total * v_row.hours / v_hours, 2);
      v_assigned := v_assigned + v_part;
      v_last := v_row.waiter_id;
      v_shares := v_shares || jsonb_build_array(jsonb_build_object(
        'waiter_id', v_row.waiter_id,
        'waiter', v_row.waiter,
        'hours', round(v_row.hours, 2),
        'amount', v_part
      ));
    end loop;
    if v_last is not null and v_assigned <> v_total then
      select jsonb_agg(
        case
          when (x->>'waiter_id')::uuid = v_last then x || jsonb_build_object('amount', round((x->>'amount')::numeric + (v_total - v_assigned), 2))
          else x
        end
      )
      into v_shares
      from jsonb_array_elements(v_shares) x;
    end if;
  end if;

  insert into public.tip_payouts (restaurant_id, period_from, period_to, mode, total, shares, notes, created_by)
  values (p_restaurant, p_from, p_to, p_mode, v_total, coalesce(v_shares, '[]'::jsonb), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.clock_in(uuid, uuid) from public, anon, authenticated;
revoke all on function public.clock_out(uuid) from public, anon, authenticated;
revoke all on function public.close_tip_payout(uuid, date, date, text, jsonb, text) from public, anon;
grant execute on function public.clock_in(uuid, uuid) to authenticated;
grant execute on function public.clock_out(uuid) to authenticated;
grant execute on function public.close_tip_payout(uuid, date, date, text, jsonb, text) to authenticated;
