-- Panel B: campos extra de carta + storage público para logos/fotos de menú

alter table public.products
  add column if not exists description text,
  add column if not exists image_url text;

alter table public.restaurants
  add column if not exists logo_url text;

-- Perfil (por si no corrieron 004 completo)
create table if not exists public.restaurant_profiles (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  phone text,
  whatsapp text,
  address text,
  city text,
  schedule text,
  confirmation_code text,
  updated_at timestamptz not null default now()
);

alter table public.restaurant_profiles enable row level security;

do $$ begin
  create policy restaurant_profiles_member on public.restaurant_profiles
    for all to authenticated
    using (public.is_member(restaurant_id))
    with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));
exception when duplicate_object then null; end $$;

-- Bucket público
insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true)
on conflict (id) do update set public = true;

-- Lectura pública de imágenes
drop policy if exists "public_media_read" on storage.objects;
create policy "public_media_read"
on storage.objects for select
to public
using (bucket_id = 'public-media');

-- Subida solo usuarios autenticados a su carpeta restaurant_id/
drop policy if exists "public_media_insert" on storage.objects;
create policy "public_media_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'public-media'
  and (storage.foldername(name))[1] is not null
);

drop policy if exists "public_media_update" on storage.objects;
create policy "public_media_update"
on storage.objects for update
to authenticated
using (bucket_id = 'public-media');

drop policy if exists "public_media_delete" on storage.objects;
create policy "public_media_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'public-media');
