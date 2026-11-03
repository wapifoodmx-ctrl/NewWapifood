-- Extiende el schema 001 con tablas del SaaS original (ApiWapifood + microservicio)
-- Seguro de re-ejecutar en lo posible (IF NOT EXISTS / or replace)

-- Perfil de restaurante (antes user_info)
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

-- Meseros (antes waiters)
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

-- Pagos de suscripción SaaS (antes payments de plan)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  plan text not null default 'basic',
  status text not null default 'trialing',
  amount numeric(10,2) not null default 0,
  provider text,
  provider_ref text,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- Pedidos web / QR (antes web_orders)
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

alter table public.restaurant_profiles enable row level security;
alter table public.waiters enable row level security;
alter table public.waiter_tables enable row level security;
alter table public.subscriptions enable row level security;
alter table public.web_orders enable row level security;
alter table public.menu_theme enable row level security;
alter table public.product_images enable row level security;

-- Políticas básicas multi-tenant
do $$ begin
  create policy restaurant_profiles_member on public.restaurant_profiles
    for all to authenticated
    using (public.is_member(restaurant_id))
    with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy waiters_member on public.waiters
    for all to authenticated
    using (public.is_member(restaurant_id))
    with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy waiter_tables_member on public.waiter_tables
    for all to authenticated
    using (exists (
      select 1 from public.waiters w
      where w.id = waiter_id and public.is_member(w.restaurant_id)
    ))
    with check (exists (
      select 1 from public.waiters w
      where w.id = waiter_id and public.has_role(w.restaurant_id, array['owner','admin']::public.app_role[])
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy subscriptions_member on public.subscriptions
    for select to authenticated
    using (public.is_member(restaurant_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy web_orders_member on public.web_orders
    for all to authenticated
    using (public.is_member(restaurant_id))
    with check (public.is_member(restaurant_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy menu_theme_member on public.menu_theme
    for all to authenticated
    using (public.is_member(restaurant_id))
    with check (public.has_role(restaurant_id, array['owner','admin']::public.app_role[]));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy product_images_member on public.product_images
    for all to authenticated
    using (exists (
      select 1 from public.products p
      where p.id = product_id and public.is_member(p.restaurant_id)
    ))
    with check (exists (
      select 1 from public.products p
      where p.id = product_id and public.has_role(p.restaurant_id, array['owner','admin']::public.app_role[])
    ));
exception when duplicate_object then null; end $$;
