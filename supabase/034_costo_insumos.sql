-- 034_costo_insumos.sql
-- Costo por insumo para calcular margen de platillos desde sus recetas.

alter table public.ingredients
  add column if not exists cost numeric(10,2) not null default 0 check (cost >= 0);
