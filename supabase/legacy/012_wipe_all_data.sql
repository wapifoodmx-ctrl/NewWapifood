-- LIMPIEZA TOTAL de datos de negocio (Wapifood / Supabase)
-- NO borra usuarios de auth.users (eso es Auth).
-- Ejecutar en SQL Editor si quieres empezar de cero.

begin;

-- Hijos primero
truncate table if exists public.order_items restart identity cascade;
truncate table if exists public.stock_moves restart identity cascade;
truncate table if exists public.recipe_lines restart identity cascade;
truncate table if exists public.waiter_tables restart identity cascade;
truncate table if exists public.orders restart identity cascade;
truncate table if exists public.subscriptions restart identity cascade;
truncate table if exists public.products restart identity cascade;
truncate table if exists public.categories restart identity cascade;
truncate table if exists public.ingredients restart identity cascade;
truncate table if exists public.dining_tables restart identity cascade;
truncate table if exists public.waiters restart identity cascade;
truncate table if exists public.menu_theme restart identity cascade;
truncate table if exists public.restaurant_profiles restart identity cascade;
truncate table if exists public.memberships restart identity cascade;
truncate table if exists public.restaurants restart identity cascade;

-- Si existen tablas extra del schema viejo
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='web_orders') then
    execute 'truncate table public.web_orders restart identity cascade';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='product_images') then
    execute 'truncate table public.product_images restart identity cascade';
  end if;
end $$;

commit;

-- Opcional: borrar usuarios de Auth (cuentas de login).
-- Descomenta SOLO si también quieres eliminar cuentas:
-- delete from auth.users;
