-- Fase 7: vínculo mesero → orden
alter table public.orders
  add column if not exists waiter_id uuid references public.waiters(id) on delete set null;

create index if not exists orders_waiter_id_idx on public.orders (waiter_id);

-- El mesero (tras login por código) asocia su id a la orden recién creada
create or replace function public.set_order_waiter(
  p_order uuid,
  p_waiter uuid,
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_ok boolean;
begin
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;

  select exists (
    select 1 from public.waiters w
    where w.id = p_waiter
      and w.restaurant_id = v_rid
      and w.active = true
      and w.access_code = trim(p_code)
  ) into v_ok;

  if not v_ok then
    raise exception 'mesero o código inválido';
  end if;

  update public.orders set waiter_id = p_waiter where id = p_order;
end;
$$;

revoke all on function public.set_order_waiter(uuid, uuid, text) from public;
grant execute on function public.set_order_waiter(uuid, uuid, text) to anon, authenticated;
