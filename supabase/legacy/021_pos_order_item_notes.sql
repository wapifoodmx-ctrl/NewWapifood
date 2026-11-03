-- Fase 4 POS: notas por línea de orden (comentarios tipo Front)
alter table public.order_items
  add column if not exists notes text;
