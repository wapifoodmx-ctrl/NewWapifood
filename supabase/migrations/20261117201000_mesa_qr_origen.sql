-- El pedido del celular se distingue de la caja y del menú web.

alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check
  check (source = any (array['pos', 'mesero', 'tablet', 'kiosko', 'web_menu', 'mesa']));
