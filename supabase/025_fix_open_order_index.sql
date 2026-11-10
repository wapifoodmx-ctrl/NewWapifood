-- 025_fix_unique_open_order_index.sql
-- Corrige el índice único de "un pedido abierto por mesa" para incluir 'pendiente'.
-- Antes solo cubría abierta/cocina/lista, lo que permitía dos pedidos pendientes
-- (web/encargo) para la misma mesa (duplicados de encargo).

drop index if exists public.one_open_order_per_table;
create unique index one_open_order_per_table
  on public.orders (table_id)
  where status in ('pendiente', 'abierta', 'cocina', 'lista');

-- Asegura que la FK orders.table_id -> dining_tables sea restrictiva (protege historial).
-- (Si tu base la tiene con cascade, esto la normaliza a restrict.)
do $$ begin
  alter table public.orders drop constraint if exists orders_table_id_fkey;
  alter table public.orders
    add constraint orders_table_id_fkey
    foreign key (table_id) references public.dining_tables(id)
    on delete restrict;
exception when others then null;
end $$;
