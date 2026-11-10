-- 031_order_items_por_linea.sql
-- Permite varias líneas del mismo platillo con notas distintas en un pedido.
-- Antes: PK compuesta (order_id, product_id) impedía duplicados.
-- Ahora: id surrogate; cada línea es independiente.

-- 1) Quitar FK de order_item_extras que dependía del PK compuesto antes de
--    reemplazar el PK (no se puede droppear un PK con FKs adyacentes sin antes
--    dropear las FKs que lo referencian).
alter table public.order_item_extras drop constraint if exists order_item_extras_order_id_product_id_fkey;

-- 2) Cambiar PK de order_items a id surrogate; cada línea es independiente.
alter table public.order_items drop constraint if exists order_items_pkey;
alter table public.order_items add column if not exists id uuid default gen_random_uuid();
alter table public.order_items alter column id set not null;
alter table public.order_items add primary key (id);
