-- Asegura lectura/escritura de ingredients para miembros del restaurante
alter table public.ingredients enable row level security;

drop policy if exists ingredients_select on public.ingredients;
drop policy if exists ingredients_insert on public.ingredients;
drop policy if exists ingredients_update on public.ingredients;
drop policy if exists ingredients_delete on public.ingredients;
drop policy if exists ingredients_member on public.ingredients;
drop policy if exists ingredients_all on public.ingredients;

create policy ingredients_select on public.ingredients
  for select to authenticated
  using (public.is_member(restaurant_id));

create policy ingredients_insert on public.ingredients
  for insert to authenticated
  with check (public.is_member(restaurant_id));

create policy ingredients_update on public.ingredients
  for update to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

create policy ingredients_delete on public.ingredients
  for delete to authenticated
  using (public.is_member(restaurant_id));

grant select, insert, update, delete on public.ingredients to authenticated;

-- Columnas opcionales usadas por la UI (si faltan, el select completo fallaba)
alter table public.ingredients
  add column if not exists kind text default 'no_perecedero',
  add column if not exists expires_on date,
  add column if not exists notes text;
