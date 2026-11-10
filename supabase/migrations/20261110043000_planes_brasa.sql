-- Planes Brasa, Comal y Fogón. Aditiva: no borra filas ni columnas.
-- Los ids viejos siguen valiendo. Las suscripciones ya pagadas no se reescriben.
-- Números iguales a src/lib/plans.js y docs/PLANES.md.

create or replace function public.canonical_plan(p_plan text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(btrim(coalesce(p_plan, '')))
    when 'brasa' then 'brasa'
    when 'ventas' then 'brasa'
    when 'esencial' then 'brasa'
    when 'brasas' then 'brasas'
    when 'ventas_multi' then 'brasas'
    when 'cadena' then 'brasas'
    when 'comal' then 'comal'
    when 'restaurante' then 'comal'
    when 'profesional' then 'comal'
    when 'comales' then 'comales'
    when 'restaurante_multi' then 'comales'
    when 'franquicia' then 'comales'
    when 'fogon' then 'fogon'
    when 'plus' then 'fogon'
    when 'empresarial' then 'fogon'
    when 'fogones' then 'fogones'
    when 'plus_multi' then 'fogones'
    when 'corporativo' then 'fogones'
    else null
  end;
$$;

create or replace function public.plan_caps_for(p_plan text)
returns table (
  max_mesas integer,
  max_meseros integer,
  max_restaurants integer,
  plan text
)
language sql
immutable
set search_path = public
as $$
  select
    case public.canonical_plan(p_plan)
      when 'brasa' then 5 when 'brasas' then 5
      when 'comal' then 15 when 'comales' then 15
      when 'fogon' then 25 when 'fogones' then 25
      else null
    end,
    case public.canonical_plan(p_plan)
      when 'brasa' then 3 when 'brasas' then 3
      when 'comal' then 7 when 'comales' then 7
      when 'fogon' then 15 when 'fogones' then 15
      else null
    end,
    case public.canonical_plan(p_plan)
      when 'brasa' then 1 when 'comal' then 1 when 'fogon' then 1
      when 'brasas' then 3
      when 'comales' then 5
      when 'fogones' then 8
      else null
    end,
    public.canonical_plan(p_plan);
$$;

-- El retorno ahora incluye max_restaurants. Postgres no deja cambiarlo con replace.
drop trigger if exists trg_waiter_plan_cap on public.waiters;
drop trigger if exists trg_table_plan_cap on public.dining_tables;
drop function if exists public.enforce_plan_caps();
drop function if exists public.create_additional_restaurant(text);
drop function if exists public.restaurant_caps(uuid);

create or replace function public.restaurant_caps(p_restaurant uuid)
returns table (
  max_mesas integer,
  max_meseros integer,
  max_restaurants integer,
  plan text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.max_mesas, c.max_meseros, c.max_restaurants, c.plan
  from public.subscriptions s
  cross join lateral public.plan_caps_for(s.plan) c
  where s.restaurant_id = p_restaurant
    and s.status in ('active', 'trialing')
    and (s.ends_at is null or s.ends_at > now())
    and c.plan is not null
  order by s.created_at desc
  limit 1;
$$;

create or replace function public.enforce_plan_caps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesas integer;
  v_meseros integer;
  v_used integer;
begin
  if tg_table_name = 'waiters' then
    if tg_op = 'UPDATE' and new.active is not true then
      return new;
    end if;
    if tg_op = 'INSERT' and new.active is not true then
      return new;
    end if;
    select max_meseros into v_meseros from public.restaurant_caps(new.restaurant_id);
    if v_meseros is null then
      raise exception 'no hay un plan vigente para dar de alta meseros';
    end if;
    select count(*) into v_used from public.waiters
    where restaurant_id = new.restaurant_id and active is true and id is distinct from new.id;
    if v_used >= v_meseros then
      raise exception 'tope de meseros del plan (%)', v_meseros;
    end if;
    return new;
  end if;

  if new.channel_type not in ('piso', 'tablet') or new.active is not true then
    return new;
  end if;
  select max_mesas into v_mesas from public.restaurant_caps(new.restaurant_id);
  if v_mesas is null then
    raise exception 'no hay un plan vigente para dar de alta mesas';
  end if;
  select count(*) into v_used from public.dining_tables
  where restaurant_id = new.restaurant_id
    and active is true
    and channel_type in ('piso', 'tablet')
    and id is distinct from new.id;
  if v_used >= v_mesas then
    raise exception 'tope de mesas del plan (%)', v_mesas;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_waiter_plan_cap on public.waiters;
create trigger trg_waiter_plan_cap
  before insert or update of active on public.waiters
  for each row execute function public.enforce_plan_caps();

drop trigger if exists trg_table_plan_cap on public.dining_tables;
create trigger trg_table_plan_cap
  before insert or update of active, channel_type on public.dining_tables
  for each row execute function public.enforce_plan_caps();

create or replace function public.activate_plan(
  p_restaurant uuid,
  p_plan text,
  p_billing text default 'mensual',
  p_provider text default 'mercadopago',
  p_provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canon text;
  v_amount numeric(10,2);
  v_days int;
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'activar plan solo desde el webhook';
  end if;

  v_canon := public.canonical_plan(p_plan);
  if v_canon is null then
    raise exception 'plan inválido';
  end if;

  if p_provider_ref is not null then
    select id into v_id
    from public.subscriptions
    where provider = coalesce(p_provider, 'mercadopago')
      and provider_ref = p_provider_ref
      and status = 'active'
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if coalesce(p_billing, 'mensual') = 'anual' then
    v_days := 365;
    v_amount := case v_canon
      when 'brasa' then 3000
      when 'comal' then 5000
      when 'fogon' then 8000
      when 'brasas' then 5000
      when 'comales' then 8000
      else 10000
    end;
  else
    v_days := 30;
    v_amount := case v_canon
      when 'brasa' then 300
      when 'comal' then 500
      when 'fogon' then 800
      when 'brasas' then 500
      when 'comales' then 800
      else 1000
    end;
  end if;

  insert into public.subscriptions (
    restaurant_id, plan, status, amount, billing, provider, provider_ref, ends_at
  ) values (
    p_restaurant,
    v_canon,
    'active',
    v_amount,
    coalesce(p_billing, 'mensual'),
    coalesce(p_provider, 'mercadopago'),
    p_provider_ref,
    now() + make_interval(days => v_days)
  )
  returning id into v_id;

  update public.subscriptions
  set status = 'replaced'
  where restaurant_id = p_restaurant
    and status in ('active', 'trialing')
    and id <> v_id;

  return v_id;
end;
$$;

create or replace function public.create_my_restaurant(p_name text default 'Mi restaurante')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select restaurant_id into v_rid from public.memberships where user_id = v_uid limit 1;
  if v_rid is not null then return v_rid; end if;
  if v_name is null then v_name := 'Mi restaurante'; end if;
  insert into public.restaurants (name) values (v_name) returning id into v_rid;
  insert into public.memberships (restaurant_id, user_id, role) values (v_rid, v_uid, 'owner');
  insert into public.subscriptions (restaurant_id, plan, status, amount, billing, provider, ends_at)
  values (v_rid, 'brasa', 'trialing', 0, 'mensual', 'trial', now() + interval '14 days');
  insert into public.restaurant_profiles (restaurant_id, confirmation_code, require_confirm_code, delivery_enabled)
  values (v_rid, lpad((floor(random() * 10000))::int::text, 4, '0'), true, false)
  on conflict (restaurant_id) do nothing;
  return v_rid;
end;
$$;

alter table public.subscriptions alter column plan set default 'brasa';

create or replace function public.create_additional_restaurant(p_name text default 'Sucursal')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_base uuid;
  v_caps record;
  v_count integer;
  v_rid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select restaurant_id into v_base
  from public.memberships
  where user_id = v_uid
  order by created_at asc
  limit 1;
  if v_base is null then raise exception 'sin restaurante base'; end if;

  select * into v_caps from public.restaurant_caps(v_base);
  if v_caps.max_restaurants is null then
    raise exception 'sin plan vigente para crear sucursales';
  end if;
  select count(*) into v_count from public.memberships where user_id = v_uid;
  if v_count >= v_caps.max_restaurants then
    raise exception 'límite de restaurantes del plan (%) alcanzado', v_caps.max_restaurants;
  end if;

  if v_name is null then v_name := 'Sucursal'; end if;
  insert into public.restaurants (name) values (v_name) returning id into v_rid;
  insert into public.memberships (restaurant_id, user_id, role)
  values (v_rid, v_uid, 'owner');

  insert into public.dining_tables (restaurant_id, number, seats, state, active, channel_type)
  select v_rid, n, case when n % 3 = 0 then 4 else 2 end, 'libre', true, 'piso'
  from generate_series(1, least(v_caps.max_mesas, 8)) as n;
  insert into public.categories (restaurant_id, name) values
    (v_rid, 'Tacos'), (v_rid, 'Antojitos'), (v_rid, 'Bebidas');

  return v_rid;
end;
$$;

revoke all on function public.canonical_plan(text) from public, anon, authenticated;
revoke all on function public.plan_caps_for(text) from public, anon, authenticated;
revoke all on function public.restaurant_caps(uuid) from public, anon, authenticated;
revoke all on function public.enforce_plan_caps() from public, anon, authenticated;
revoke all on function public.activate_plan(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_additional_restaurant(text) from public, anon, authenticated;

grant execute on function public.restaurant_caps(uuid) to authenticated;
grant execute on function public.create_additional_restaurant(text) to authenticated;
grant execute on function public.activate_plan(uuid, text, text, text, text) to service_role;
grant execute on function public.create_my_restaurant(text) to authenticated;
