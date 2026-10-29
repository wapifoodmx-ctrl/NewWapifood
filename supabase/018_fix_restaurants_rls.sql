-- Fix: nombre y logo no se persistían
-- Causa: solo existía SELECT público en restaurants; no había UPDATE para el owner.

alter table public.restaurants enable row level security;

-- Lectura (menú público + panel)
drop policy if exists restaurants_public_read on public.restaurants;
create policy restaurants_public_read on public.restaurants
  for select to anon, authenticated
  using (true);

-- Owner/admin pueden actualizar su restaurante
drop policy if exists restaurants_member_update on public.restaurants;
create policy restaurants_member_update on public.restaurants
  for update to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurants.id
        and m.user_id = auth.uid()
        and m.role::text in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurants.id
        and m.user_id = auth.uid()
        and m.role::text in ('owner', 'admin')
    )
  );

-- Asegura logo_url
alter table public.restaurants
  add column if not exists logo_url text;

-- Perfil: permitir upsert al owner (por si with check de has_role/app_role fallaba)
drop policy if exists restaurant_profiles_member on public.restaurant_profiles;
drop policy if exists restaurant_profiles_select on public.restaurant_profiles;
drop policy if exists restaurant_profiles_write on public.restaurant_profiles;

create policy restaurant_profiles_select on public.restaurant_profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurant_profiles.restaurant_id
        and m.user_id = auth.uid()
    )
  );

create policy restaurant_profiles_write on public.restaurant_profiles
  for all to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurant_profiles.restaurant_id
        and m.user_id = auth.uid()
        and m.role::text in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurant_profiles.restaurant_id
        and m.user_id = auth.uid()
        and m.role::text in ('owner', 'admin')
    )
  );
