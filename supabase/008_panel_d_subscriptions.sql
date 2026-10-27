-- Panel D: suscripciones SaaS, movimientos de stock visibles, integridad

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  plan text not null default 'ventas',
  status text not null default 'trialing',
  amount numeric(10,2) not null default 0,
  billing text not null default 'mensual',
  provider text default 'manual',
  provider_ref text,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_restaurant_idx on public.subscriptions (restaurant_id, created_at desc);

alter table public.subscriptions enable row level security;

do $$ begin
  create policy subscriptions_select on public.subscriptions
    for select to authenticated
    using (public.is_member(restaurant_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy subscriptions_write on public.subscriptions
    for all to authenticated
    using (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]))
    with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));
exception when duplicate_object then null; end $$;

-- stock_moves: lectura para miembros (si la tabla existe del 001)
do $$ begin
  alter table public.stock_moves enable row level security;
exception when undefined_table then null; end $$;

do $$ begin
  create policy stock_moves_select on public.stock_moves
    for select to authenticated
    using (
      exists (
        select 1 from public.ingredients i
        where i.id = ingredient_id and public.is_member(i.restaurant_id)
      )
    );
exception when duplicate_object then null; when undefined_table then null; end $$;

-- Activar / renovar plan (simulado hasta integrar Stripe/MP)
create or replace function public.activate_plan(
  p_restaurant uuid,
  p_plan text,
  p_billing text default 'mensual'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric(10,2);
  v_days int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'no autenticado';
  end if;

  if not public.has_role(p_restaurant, array['owner','admin']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;

  if p_plan not in ('ventas', 'restaurante', 'plus') then
    raise exception 'plan inválido';
  end if;

  if p_billing = 'anual' then
    v_days := 365;
    v_amount := case p_plan
      when 'ventas' then 4000
      when 'restaurante' then 6000
      else 8000
    end;
  else
    v_days := 30;
    v_amount := case p_plan
      when 'ventas' then 400
      when 'restaurante' then 600
      else 800
    end;
  end if;

  insert into public.subscriptions (
    restaurant_id, plan, status, amount, billing, provider, ends_at
  ) values (
    p_restaurant,
    p_plan,
    'active',
    v_amount,
    p_billing,
    'manual',
    now() + make_interval(days => v_days)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.activate_plan(uuid, text, text) from public;
grant execute on function public.activate_plan(uuid, text, text) to authenticated;

-- Trial automático al crear restaurante (extiende onboarding)
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
  if v_uid is null then
    raise exception 'no autenticado';
  end if;

  select restaurant_id into v_rid
  from public.memberships
  where user_id = v_uid
  limit 1;

  if v_rid is not null then
    return v_rid;
  end if;

  if v_name is null then
    v_name := 'Mi restaurante';
  end if;

  insert into public.restaurants (name)
  values (v_name)
  returning id into v_rid;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_rid, v_uid, 'owner');

  insert into public.dining_tables (restaurant_id, number, seats, state, active)
  select v_rid, n, case when n % 3 = 0 then 4 else 2 end, 'libre', true
  from generate_series(1, 8) as n;

  insert into public.categories (restaurant_id, name) values
    (v_rid, 'Tacos'),
    (v_rid, 'Antojitos'),
    (v_rid, 'Bebidas');

  insert into public.subscriptions (restaurant_id, plan, status, amount, billing, provider, ends_at)
  values (v_rid, 'ventas', 'trialing', 0, 'mensual', 'trial', now() + interval '14 days');

  return v_rid;
end;
$$;
