-- Captura columnas y la función hechas directo en la base.
-- No reescribe filas. En producción estas columnas ya existen.

alter table public.orders
  add column if not exists refunded_amount numeric(10,2) not null default 0;

alter table public.orders
  add column if not exists tip_method public.pay_method;

alter table public.order_items
  add column if not exists refunded_amount numeric(10,2) not null default 0;
