-- 032_order_items_status_por_linea.sql
-- Permite cambiar el estado de un ítem por línea (id), no por producto,
-- para que dos líneas del mismo platillo con notas distintas se gestionen por separado.

-- DROP previo: cambia el nombre del parámetro (p_product -> p_line),
-- lo cual no se puede hacer con CREATE OR REPLACE.
drop function if exists public.set_order_item_status(uuid, uuid, text);

create or replace function public.set_order_item_status(p_order uuid, p_line uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_rid uuid; v_ord_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_status not in ('pendiente', 'preparado', 'cancelado') then raise exception 'status de ítem inválido'; end if;
  select restaurant_id, status::text into v_rid, v_ord_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_ord_status in ('pagada', 'cancelada') then raise exception 'la orden ya está cerrada'; end if;
  update public.order_items set status = p_status where id = p_line and order_id = p_order;
  if not found then raise exception 'ítem no existe en la orden'; end if;
  return public.recompute_order_status(p_order);
end;
$$;

revoke all on function public.set_order_item_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_order_item_status(uuid, uuid, text) to authenticated;
