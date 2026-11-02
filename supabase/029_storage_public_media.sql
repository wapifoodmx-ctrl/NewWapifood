-- ============================================================
-- Storage público para logos y fotos de productos
-- Bucket: public-media  (path: {restaurant_id}/logos|products/...)
-- ============================================================

-- Crear bucket si no existe (API storage vía SQL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880;

-- Políticas storage.objects
drop policy if exists "public_media_read" on storage.objects;
drop policy if exists "public_media_insert_auth" on storage.objects;
drop policy if exists "public_media_update_auth" on storage.objects;
drop policy if exists "public_media_delete_auth" on storage.objects;

-- Lectura pública (menú digital / QR)
create policy "public_media_read" on storage.objects
  for select
  to public
  using (bucket_id = 'public-media');

-- Subida: usuario autenticado, carpeta = su restaurant_id (primer segmento del path)
create policy "public_media_insert_auth" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'public-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

create policy "public_media_update_auth" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'public-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

create policy "public_media_delete_auth" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'public-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

-- Refuerzo RLS restaurants logo (por si 018 no corrió)
drop policy if exists restaurants_update_member on public.restaurants;
create policy restaurants_update_member on public.restaurants
  for update to authenticated
  using (public.is_member(id))
  with check (public.is_member(id));

-- Products image_url update ya cubierto por is_member en products


-- Insumos: refuerzo RLS (TC-007 / TC-010)
alter table public.ingredients enable row level security;
drop policy if exists ingredients_select on public.ingredients;
drop policy if exists ingredients_insert on public.ingredients;
drop policy if exists ingredients_update on public.ingredients;
drop policy if exists ingredients_delete on public.ingredients;
create policy ingredients_select on public.ingredients for select to authenticated using (public.is_member(restaurant_id));
create policy ingredients_insert on public.ingredients for insert to authenticated with check (public.is_member(restaurant_id));
create policy ingredients_update on public.ingredients for update to authenticated using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
create policy ingredients_delete on public.ingredients for delete to authenticated using (public.is_member(restaurant_id));
grant select, insert, update, delete on public.ingredients to authenticated;
alter table public.ingredients add column if not exists kind text default 'no_perecedero';
alter table public.ingredients add column if not exists expires_on date;
alter table public.ingredients add column if not exists notes text;
