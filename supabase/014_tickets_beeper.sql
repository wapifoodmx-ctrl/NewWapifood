-- BLOQUE 3: Tickets tipo beeper + cancelación formal
-- (Ya aplicado en tu Supabase si corriste el SQL antes)

alter table public.orders
  add column if not exists cancel_reason text,
  add column if not exists public_code text;

drop policy if exists orders_public_beeper on public.orders;
create policy orders_public_beeper on public.orders
  for select to anon, authenticated using (true);

drop policy if exists order_items_public_beeper on public.order_items;
create policy order_items_public_beeper on public.order_items
  for select to anon, authenticated using (true);

create or replace function public.ensure_order_public_code()
returns trigger language plpgsql as $$
begin
  if new.public_code is null or length(trim(new.public_code)) = 0 then
    new.public_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_public_code on public.orders;
create trigger trg_order_public_code
  before insert on public.orders
  for each row execute function public.ensure_order_public_code();

update public.orders
set public_code = upper(substr(replace(id::text, '-', ''), 1, 8))
where public_code is null;

create or replace function public.cancel_order(p_order uuid, p_reason text default 'cancelada por el local')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rid uuid; v_table uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, table_id, status into v_rid, v_table, v_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'la orden ya está cerrada'; end if;
  update public.orders set status = 'cancelada', cancel_reason = coalesce(nullif(trim(p_reason), ''), 'cancelada por el local'), closed_at = now() where id = p_order;
  if v_table is not null and not exists (select 1 from public.orders o where o.table_id = v_table and o.id <> p_order and o.status not in ('pagada', 'cancelada')) then
    update public.dining_tables set state = 'libre' where id = v_table;
  end if;
end;
$$;
revoke all on function public.cancel_order(uuid, text) from public;
grant execute on function public.cancel_order(uuid, text) to authenticated;

create or replace function public.set_order_status(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_status not in ('pendiente', 'cocina', 'lista', 'entregada', 'abierta') then raise exception 'estado inválido'; end if;
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  update public.orders set status = p_status where id = p_order and status not in ('pagada', 'cancelada');
end;
$$;
revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;
