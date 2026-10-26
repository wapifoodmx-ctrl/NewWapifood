-- Seed demo Wapifood (idempotente por UUIDs fijos)
-- Ejecutar en SQL Editor de Supabase DESPUÉS de 001_wapifood_supabase.sql
-- No crea memberships: se enlazan al primer usuario autenticado con 003_bootstrap_owner.sql

begin;

-- Restaurante demo
insert into public.restaurants (id, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Taquería Demo Wapifood')
on conflict (id) do update set name = excluded.name;

-- Categorías
insert into public.categories (id, restaurant_id, name) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tacos'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Antojitos'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bebidas')
on conflict (id) do update set name = excluded.name;

-- Productos (carta + costo)
insert into public.products (id, restaurant_id, category_id, name, price, cost, active) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Tacos de pastor', 48.00, 18.00, true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Tacos de suadero', 52.00, 20.00, true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Quesadilla de champiñón', 64.00, 22.00, true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Gringa', 78.00, 28.00, true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Agua de jamaica', 32.00, 6.00, true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Refresco', 28.00, 12.00, true)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  cost = excluded.cost,
  active = excluded.active;

-- Insumos (antes microservicio)
insert into public.ingredients (id, restaurant_id, name, unit, stock, min_stock) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tortilla', 'pza', 180, 40),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pastor', 'g', 2400, 600),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Suadero', 'g', 900, 500),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Queso', 'g', 700, 250),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jamaica', 'ml', 4000, 800),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Refresco lata', 'pza', 24, 12)
on conflict (id) do update set
  stock = excluded.stock,
  min_stock = excluded.min_stock,
  unit = excluded.unit;

-- Recetas producto → insumos
insert into public.recipe_lines (product_id, ingredient_id, qty) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 2),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 80),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 2),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 90),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', 60),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 70),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', 40),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc5', 'dddddddd-dddd-dddd-dddd-ddddddddddd5', 350),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc6', 'dddddddd-dddd-dddd-dddd-ddddddddddd6', 1)
on conflict (product_id, ingredient_id) do update set qty = excluded.qty;

-- Mesas
insert into public.dining_tables (id, restaurant_id, number, seats, state, active) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 2, 'libre', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 2, 'libre', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 4, 'libre', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4, 2, 'libre', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, 4, 'libre', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 6, 2, 'libre', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee7', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 7, 4, 'libre', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee8', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 8, 2, 'libre', true)
on conflict (id) do update set seats = excluded.seats, active = excluded.active;

commit;
