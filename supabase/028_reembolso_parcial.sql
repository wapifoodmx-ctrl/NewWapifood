-- 028_reembolso_parcial.sql
-- Reembolso parcial por platillo cobrado: registra monto reembolsado por ítem.

alter table public.order_items
  add column if not exists refunded_amount numeric(10,2) not null default 0;
