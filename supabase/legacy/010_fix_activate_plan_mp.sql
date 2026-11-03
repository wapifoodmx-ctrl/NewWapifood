-- Fix activate_plan (error 400) + columnas MP. Sin Stripe.

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

alter table public.subscriptions
  add column if not exists billing text default 'mensual',
  add column if not exists provider text default 'manual',
  add column if not exists provider_ref text;

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = subscriptions.restaurant_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = subscriptions.restaurant_id
        and m.user_id = auth.uid()
        and m.role::text in ('owner', 'admin')
    )
  );

-- Elimina firmas viejas conflictivas
drop function if exists public.activate_plan(uuid, text, text);
drop function if exists public.activate_plan(uuid, text, text, text, text);

create or replace function public.activate_plan(
  p_restaurant uuid,
  p_plan text,
  p_billing text default 'mensual',
  p_provider text default 'manual',
  p_provider_ref text default null
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
  v_ok boolean;
begin
  if v_uid is null then
    raise exception 'no autenticado';
  end if;

  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = p_restaurant
      and m.user_id = v_uid
      and m.role::text in ('owner', 'admin')
  ) into v_ok;

  if not v_ok then
    raise exception 'sin permiso: no eres owner/admin de este restaurante';
  end if;

  if p_plan not in ('ventas', 'restaurante', 'plus') then
    raise exception 'plan inválido';
  end if;

  if coalesce(p_billing, 'mensual') = 'anual' then
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
    restaurant_id, plan, status, amount, billing, provider, provider_ref, ends_at
  ) values (
    p_restaurant,
    p_plan,
    'active',
    v_amount,
    coalesce(p_billing, 'mensual'),
    coalesce(p_provider, 'manual'),
    p_provider_ref,
    now() + make_interval(days => v_days)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.activate_plan(uuid, text, text, text, text) from public;
grant execute on function public.activate_plan(uuid, text, text, text, text) to authenticated;
