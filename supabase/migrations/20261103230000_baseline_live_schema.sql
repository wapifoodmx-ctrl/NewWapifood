-- Baseline del esquema vivo de Supabase bdimvrykjcvccbjczqkh (2026-11-03).
-- NO ejecutar sobre producción: marcarla aplicada antes del primer db push.
--   supabase migration repair --status applied 20261103230000 --remote -p "$SUPABASE_DB_PASSWORD"
-- Las firmas viejas de close_order(pay_method) y place_public_order (5, 6 y 7 args)
-- existen en la base viva y las elimina 20261103231000. Aquí queda la firma que usa el código.
-- 002_seed_demo y 012_wipe_all_data no forman parte de esta migración.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'piso', 'cocina');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'abierta', 'cocina', 'lista', 'pagada', 'cancelada', 'pendiente', 'entregada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.table_state as enum ('libre', 'ocupada', 'no_disponible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pay_method as enum ('efectivo', 'tarjeta', 'transferencia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_reason as enum ('venta', 'entrada', 'merma', 'ajuste');
exception when duplicate_object then null; end $$;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now(),
  logo_url text
);

create table if not exists public.memberships (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  sort_order integer not null default 0,
  unique (restaurant_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  name text not null check (char_length(name) between 1 and 120),
  price numeric not null check (price >= 0),
  cost numeric not null default 0 check (cost >= 0),
  active boolean not null default true,
  description text,
  image_url text,
  inventory_mode text default 'unitario'
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  unit text not null,
  stock numeric not null default 0 check (stock >= 0),
  min_stock numeric not null default 0 check (min_stock >= 0),
  kind text not null default 'no_perecedero' check (kind in ('perecedero', 'no_perecedero')),
  expires_on date,
  notes text,
  is_extra boolean not null default false,
  unique (restaurant_id, name)
);

create table if not exists public.recipe_lines (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  qty numeric not null check (qty > 0),
  primary key (product_id, ingredient_id)
);

create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  number integer not null check (number > 0),
  seats integer not null check (seats between 1 and 20),
  state public.table_state not null default 'libre',
  active boolean not null default true,
  channel_type text not null default 'piso' check (channel_type in ('caja', 'piso', 'tablet', 'kiosko')),
  access_pin text,
  unique (restaurant_id, number)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id),
  status public.order_status not null default 'abierta',
  method public.pay_method,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  stock_applied boolean not null default false,
  source text not null default 'pos' check (source in ('pos', 'mesero', 'tablet', 'kiosko', 'web_menu')),
  needs_confirmation boolean not null default false,
  cancel_reason text,
  public_code text,
  order_type text not null default 'mesa' check (order_type in ('mesa', 'domicilio')),
  customer_phone text,
  delivery_address text,
  discount_type text check (discount_type is null or discount_type in ('porcentaje', 'monto')),
  discount_value numeric default 0,
  discount_amount numeric default 0,
  payment_method text,
  customer_name text,
  notes text,
  waiter_id uuid
);

create table if not exists public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  unit_price numeric not null check (unit_price >= 0),
  notes text,
  status text not null default 'pendiente' check (status in ('pendiente', 'preparado', 'cancelado')),
  discount_type text check (discount_type is null or discount_type in ('porcentaje', 'monto')),
  discount_value numeric default 0,
  primary key (order_id, product_id)
);

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  order_id uuid references public.orders(id),
  qty numeric not null,
  reason public.stock_reason not null,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_profiles (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  phone text,
  whatsapp text,
  address text,
  city text,
  schedule text,
  confirmation_code text,
  updated_at timestamptz not null default now(),
  delivery_enabled boolean not null default false,
  require_confirm_code boolean not null default true,
  postal_code text,
  inventory_pin text
);

create table if not exists public.waiters (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  access_code text not null check (char_length(access_code) between 4 and 8),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, access_code)
);

create table if not exists public.waiter_tables (
  waiter_id uuid not null references public.waiters(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  primary key (waiter_id, table_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  plan text not null default 'basic',
  status text not null default 'trialing',
  amount numeric not null default 0,
  provider text,
  provider_ref text,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  billing text default 'mensual'
);

create table if not exists public.web_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid references public.orders(id),
  customer_name text,
  customer_phone text,
  customer_address text,
  notes text,
  status text not null default 'nuevo',
  created_at timestamptz not null default now()
);

create table if not exists public.menu_theme (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  primary_color text default '#c45c26',
  secondary_color text default '#1c1917',
  logo_url text
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.product_extras (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  qty numeric not null default 1 check (qty > 0),
  extra_price numeric not null default 0,
  primary key (product_id, ingredient_id)
);

create unique index if not exists one_open_order_per_table
  on public.orders (table_id)
  where status = any (array['abierta'::public.order_status, 'cocina'::public.order_status, 'lista'::public.order_status]);

create index if not exists orders_open_idx on public.orders (restaurant_id, status);
create index if not exists subscriptions_restaurant_idx on public.subscriptions (restaurant_id, created_at desc);

create or replace function public.is_member(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = rid and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_role(rid uuid, roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = rid
      and m.user_id = auth.uid()
      and m.role = any(roles)
  );
$$;

create or replace function public.ensure_order_public_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.public_code is null or length(trim(new.public_code)) = 0 then
    new.public_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

create or replace function public.order_items_default_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is null or new.status = '' then
    new.status := 'pendiente';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_public_code on public.orders;
create trigger trg_order_public_code
  before insert on public.orders
  for each row execute function public.ensure_order_public_code();

drop trigger if exists trg_order_items_status on public.order_items;
create trigger trg_order_items_status
  before insert on public.order_items
  for each row execute function public.order_items_default_status();

alter table public.restaurants enable row level security;
alter table public.memberships enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_lines enable row level security;
alter table public.dining_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_moves enable row level security;
alter table public.restaurant_profiles enable row level security;
alter table public.waiters enable row level security;
alter table public.waiter_tables enable row level security;
alter table public.subscriptions enable row level security;
alter table public.web_orders enable row level security;
alter table public.menu_theme enable row level security;
alter table public.product_images enable row level security;
alter table public.product_extras enable row level security;

-- Políticas tal como están en producción (incluye duplicados). La siguiente migración las aprieta.
drop policy if exists restaurants_public_read on public.restaurants;
create policy restaurants_public_read on public.restaurants for select to anon, authenticated using (true);
drop policy if exists restaurants_read on public.restaurants;
create policy restaurants_read on public.restaurants for select to authenticated using (public.is_member(id));
drop policy if exists restaurants_member_update on public.restaurants;
create policy restaurants_member_update on public.restaurants for update to authenticated
  using (exists (select 1 from public.memberships m where m.restaurant_id = restaurants.id and m.user_id = auth.uid() and m.role::text = any (array['owner','admin'])))
  with check (exists (select 1 from public.memberships m where m.restaurant_id = restaurants.id and m.user_id = auth.uid() and m.role::text = any (array['owner','admin'])));
drop policy if exists restaurants_update_member on public.restaurants;
create policy restaurants_update_member on public.restaurants for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists memberships_self on public.memberships;
create policy memberships_self on public.memberships for select to authenticated using (user_id = auth.uid());

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
drop policy if exists categories_rw on public.categories;
create policy categories_rw on public.categories for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated using (active = true);
drop policy if exists products_rw on public.products;
create policy products_rw on public.products for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));

drop policy if exists ingredients_read on public.ingredients;
create policy ingredients_read on public.ingredients for select to authenticated using (public.is_member(restaurant_id));
drop policy if exists ingredients_select on public.ingredients;
create policy ingredients_select on public.ingredients for select to authenticated using (public.is_member(restaurant_id));
drop policy if exists ingredients_insert on public.ingredients;
create policy ingredients_insert on public.ingredients for insert to authenticated with check (public.is_member(restaurant_id));
drop policy if exists ingredients_update on public.ingredients;
create policy ingredients_update on public.ingredients for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
drop policy if exists ingredients_delete on public.ingredients;
create policy ingredients_delete on public.ingredients for delete to authenticated using (public.is_member(restaurant_id));
drop policy if exists ingredients_write on public.ingredients;
create policy ingredients_write on public.ingredients for all to authenticated
  using (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]))
  with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));

drop policy if exists dining_tables_public_read on public.dining_tables;
create policy dining_tables_public_read on public.dining_tables for select to anon, authenticated using (true);
drop policy if exists tables_public_read on public.dining_tables;
create policy tables_public_read on public.dining_tables for select to anon, authenticated using (active = true);
drop policy if exists tables_read on public.dining_tables;
create policy tables_read on public.dining_tables for select to authenticated using (public.is_member(restaurant_id));
drop policy if exists tables_write on public.dining_tables;
create policy tables_write on public.dining_tables for all to authenticated
  using (public.has_role(restaurant_id, array['owner','admin','piso']::public.app_role[]))
  with check (public.has_role(restaurant_id, array['owner','admin','piso']::public.app_role[]));

drop policy if exists orders_public_beeper on public.orders;
create policy orders_public_beeper on public.orders for select to anon, authenticated using (true);
drop policy if exists orders_rw on public.orders;
create policy orders_rw on public.orders for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.has_role(restaurant_id, array['owner','admin','piso','cocina']::public.app_role[]));

drop policy if exists order_items_public_beeper on public.order_items;
create policy order_items_public_beeper on public.order_items for select to anon, authenticated using (true);
drop policy if exists items_via_order on public.order_items;
create policy items_via_order on public.order_items for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and public.is_member(o.restaurant_id)))
  with check (exists (select 1 from public.orders o where o.id = order_items.order_id and public.has_role(o.restaurant_id, array['owner','admin','piso']::public.app_role[])));

drop policy if exists moves_read on public.stock_moves;
create policy moves_read on public.stock_moves for select to authenticated using (public.is_member(restaurant_id));
drop policy if exists stock_moves_select on public.stock_moves;
create policy stock_moves_select on public.stock_moves for select to authenticated
  using (exists (select 1 from public.ingredients i where i.id = stock_moves.ingredient_id and public.is_member(i.restaurant_id)));

drop policy if exists restaurant_profiles_select on public.restaurant_profiles;
create policy restaurant_profiles_select on public.restaurant_profiles for select to authenticated
  using (exists (select 1 from public.memberships m where m.restaurant_id = restaurant_profiles.restaurant_id and m.user_id = auth.uid()));
drop policy if exists restaurant_profiles_write on public.restaurant_profiles;
create policy restaurant_profiles_write on public.restaurant_profiles for all to authenticated
  using (exists (select 1 from public.memberships m where m.restaurant_id = restaurant_profiles.restaurant_id and m.user_id = auth.uid() and m.role::text = any (array['owner','admin'])))
  with check (exists (select 1 from public.memberships m where m.restaurant_id = restaurant_profiles.restaurant_id and m.user_id = auth.uid() and m.role::text = any (array['owner','admin'])));

drop policy if exists waiters_member on public.waiters;
create policy waiters_member on public.waiters for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));
drop policy if exists waiter_tables_member on public.waiter_tables;
create policy waiter_tables_member on public.waiter_tables for all to authenticated
  using (exists (select 1 from public.waiters w where w.id = waiter_tables.waiter_id and public.is_member(w.restaurant_id)))
  with check (exists (select 1 from public.waiters w where w.id = waiter_tables.waiter_id and public.has_role(w.restaurant_id, array['owner','admin']::public.app_role[])));

drop policy if exists subscriptions_member on public.subscriptions;
create policy subscriptions_member on public.subscriptions for select to authenticated using (public.is_member(restaurant_id));
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (exists (select 1 from public.memberships m where m.restaurant_id = subscriptions.restaurant_id and m.user_id = auth.uid()));
drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions for insert to authenticated
  with check (exists (select 1 from public.memberships m where m.restaurant_id = subscriptions.restaurant_id and m.user_id = auth.uid() and m.role::text = any (array['owner','admin'])));
drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions for all to authenticated
  using (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]))
  with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));

drop policy if exists web_orders_member on public.web_orders;
create policy web_orders_member on public.web_orders for all to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

drop policy if exists menu_theme_public_read on public.menu_theme;
create policy menu_theme_public_read on public.menu_theme for select to anon, authenticated using (true);
drop policy if exists menu_theme_member on public.menu_theme;
create policy menu_theme_member on public.menu_theme for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));

drop policy if exists product_images_member on public.product_images;
create policy product_images_member on public.product_images for all to authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id and public.is_member(p.restaurant_id)))
  with check (exists (select 1 from public.products p where p.id = product_images.product_id and public.has_role(p.restaurant_id, array['owner','admin']::public.app_role[])));

drop policy if exists product_extras_select on public.product_extras;
create policy product_extras_select on public.product_extras for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_extras.product_id and (public.is_member(p.restaurant_id) or true)));
drop policy if exists product_extras_write on public.product_extras;
create policy product_extras_write on public.product_extras for all to authenticated
  using (exists (select 1 from public.products p where p.id = product_extras.product_id and public.is_member(p.restaurant_id)))
  with check (exists (select 1 from public.products p where p.id = product_extras.product_id and public.is_member(p.restaurant_id)));

drop policy if exists recipe_lines_select on public.recipe_lines;
create policy recipe_lines_select on public.recipe_lines for select to authenticated
  using (exists (select 1 from public.products p where p.id = recipe_lines.product_id and public.is_member(p.restaurant_id)));
drop policy if exists recipe_lines_insert on public.recipe_lines;
create policy recipe_lines_insert on public.recipe_lines for insert to authenticated
  with check (
    exists (select 1 from public.products p where p.id = recipe_lines.product_id and public.is_member(p.restaurant_id))
    and exists (
      select 1 from public.products p
      join public.ingredients i on i.restaurant_id = p.restaurant_id
      where p.id = recipe_lines.product_id and i.id = recipe_lines.ingredient_id
    )
  );
drop policy if exists recipe_lines_update on public.recipe_lines;
create policy recipe_lines_update on public.recipe_lines for update to authenticated
  using (exists (select 1 from public.products p where p.id = recipe_lines.product_id and public.is_member(p.restaurant_id)))
  with check (
    exists (select 1 from public.products p where p.id = recipe_lines.product_id and public.is_member(p.restaurant_id))
    and exists (
      select 1 from public.products p
      join public.ingredients i on i.restaurant_id = p.restaurant_id
      where p.id = recipe_lines.product_id and i.id = recipe_lines.ingredient_id
    )
  );
drop policy if exists recipe_lines_delete on public.recipe_lines;
create policy recipe_lines_delete on public.recipe_lines for delete to authenticated
  using (exists (select 1 from public.products p where p.id = recipe_lines.product_id and public.is_member(p.restaurant_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif','image/jpg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['orders','order_items','dining_tables'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

alter table public.orders replica identity full;
alter table public.order_items replica identity full;
alter table public.dining_tables replica identity full;
