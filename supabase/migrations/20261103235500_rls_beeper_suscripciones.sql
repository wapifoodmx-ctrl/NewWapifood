-- Cierra escritura de suscripciones desde el cliente y la lectura pública de todas las órdenes.
-- Idempotente. No borra filas.
-- El trial sigue creándose en create_my_restaurant (security definer).
-- El cobro pendiente y la activación van con service role (checkout y webhook).
-- has_active_plan y ensure_restaurant_profile no las llama el cliente: no se reabre EXECUTE.

drop policy if exists subscriptions_write on public.subscriptions;
drop policy if exists subscriptions_insert on public.subscriptions;

-- Dos SELECT de miembros: se queda el que usa is_member.
drop policy if exists subscriptions_select on public.subscriptions;

drop policy if exists orders_public_beeper on public.orders;
drop policy if exists order_items_public_beeper on public.order_items;

-- Lectura pública de mesas inactivas (USING true) duplica y ensancha tables_public_read.
drop policy if exists dining_tables_public_read on public.dining_tables;

-- SELECT de miembros ya cubierto por la lectura pública del restaurante.
drop policy if exists restaurants_read on public.restaurants;

-- UPDATE de owner/admin ya cubierto por restaurants_update_member (cualquier miembro).
drop policy if exists restaurants_member_update on public.restaurants;

-- SELECT de kardex duplicado: moves_read ya filtra por membresía.
drop policy if exists stock_moves_select on public.stock_moves;

-- ALL de owner/admin duplicado: insert/update/delete de miembros ya existen.
drop policy if exists ingredients_write on public.ingredients;

-- El ticket público solo ve una orden, por esta función.
grant execute on function public.get_public_ticket(uuid) to anon, authenticated;
