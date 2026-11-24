-- La cuenta del celular muestra el folio, los extras y si caja rechazó el pedido.
-- Reemplaza get_table_bill. No borra filas.

create or replace function public.get_table_bill(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
  v_code text;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  select public_code into v_code from public.orders where id = v.order_id;
  return jsonb_build_object(
    'order_id', v.order_id,
    'public_code', v_code,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name,
        'qty', oi.qty,
        'price', oi.unit_price,
        'status', oi.status,
        'notes', oi.notes,
        'extras', coalesce((
          select jsonb_agg(jsonb_build_object('name', m.name, 'extra_price', m.extra_price))
          from public.order_item_modifiers m
          where m.order_item_id = oi.id
        ), '[]'::jsonb)
      ))
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = v.order_id and coalesce(oi.status, 'pendiente') <> 'cancelado'
    ), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status, 'items', r.items))
      from public.table_requests r
      where r.session_id = v.id and r.status = 'pendiente'
    ), '[]'::jsonb),
    'rejected', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'kind', r.kind,
        'reason', r.reason,
        'items', r.items
      ) order by r.created_at desc)
      from public.table_requests r
      where r.session_id = v.id
        and r.status = 'rechazado'
        and r.created_at > now() - interval '3 hours'
    ), '[]'::jsonb),
    'total', coalesce(public.order_subtotal(v.order_id), 0)
  );
end;
$$;

grant execute on function public.get_table_bill(text) to anon, authenticated;
