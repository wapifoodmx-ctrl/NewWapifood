-- 029_reembolso_libre.sql
-- Reembolso parcial por monto libre (no por platillo). Se acumula en orders.refunded_amount.

alter table public.orders
  add column if not exists refunded_amount numeric(10,2) not null default 0;
