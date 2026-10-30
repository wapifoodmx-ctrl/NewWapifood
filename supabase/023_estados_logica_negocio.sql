
-- ============================================================
-- L1–L5: Lógica de estados alineada a WapifoodFront
-- - Status por ítem (Pendiente/Preparado/Cancelado)
-- - Mesas: libre | ocupada | no_disponible
-- - Recomputo de status de orden desde ítems
-- ============================================================

-- 1) Ítems
alter table public.order_items
  add column if not exists status text not null default 'pendiente';

do $$ begin
  alter table public.order_items drop constraint if exists order_items_status_check;
  alter table public.order_items
    add constraint order_items_status_check
    check (status in ('pendiente', 'preparado', 'cancelado'));
exception when others then null;
end $$;

update public.order_items set status = 'pendiente' where status is null or status = '';

-- 2) Mesas: ampliar estados
-- Si había check estricto, lo relajamos
do $$ begin
  alter table public.dining_tables drop constraint if exists dining_tables_state_check;
exception when others then null;
end $$;

do $$ begin
  alter table public.dining_tables
    add constraint dining_tables_state_check
    check (state in ('libre', 'ocupada', 'no_disponible'));
exception when others then null;
end $$;

-- 3) Recomputar status de orden a partir de ítems (estilo Front)
create or replace function public.recompute_order_status(p_order uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_active int;
  v_pend int;
  v_prep int;
  v_table uuid;
begin
  select status, table_id into v_status, v_table
  from public.orders where id = p_order;

  if v_status is null then
    raise exception 'orden no existe';
  end if;

  -- No tocar órdenes ya cerradas
  if v_status in ('pagada', 'cancelada') then
    return v_status;
  end if;

  -- No forzar si sigue pendiente de confirmación web
  if v_status = 'pendiente' then
    return v_status;
  end if;

  select
    count(*) filter (where status <> 'cancelado'),
    count(*) filter (where status = 'pendiente'),
    count(*) filter (where status = 'preparado')
  into v_active, v_pend, v_prep
  from public.order_items
  where order_id = p_order;

  if v_active = 0 then
    -- todos cancelados → cancelar orden y liberar mesa
    update public.orders
      set status = 'cancelada', closed_at = coalesce(closed_at, now())
    where id = p_order;
    if v_table is not null and not exists (
      select 1 from public.orders o
      where o.table_id = v_table and o.id <> p_order
        and o.status not in ('pagada', 'cancelada')
    ) then
      update public.dining_tables set state = 'libre' where id = v_table and state <> 'no_disponible';
    end if;
    return 'cancelada';
  end if;

  if v_pend = 0 and v_prep = v_active then
    update public.orders set status = 'lista' where id = p_order;
    return 'lista';
  end if;

  -- hay pendientes → cocina (o abierta si nunca se envió; preferimos cocina si ya hubo envío)
  if v_status in ('lista', 'entregada', 'cocina', 'abierta') then
    update public.orders set status = 'cocina' where id = p_order and status not in ('pagada', 'cancelada', 'pendiente');
    return 'cocina';
  end if;

  return v_status;
end;
$$;

revoke all on function public.recompute_order_status(uuid) from public;
grant execute on function public.recompute_order_status(uuid) to authenticated;

-- 4) Cambiar status de un ítem (cocina / POS)
create or replace function public.set_order_item_status(
  p_order uuid,
  p_product uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_ord_status text;
  v_new text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_status not in ('pendiente', 'preparado', 'cancelado') then
    raise exception 'status de ítem inválido';
  end if;

  select restaurant_id, status into v_rid, v_ord_status
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_ord_status in ('pagada', 'cancelada') then
    raise exception 'la orden ya está cerrada';
  end if;

  update public.order_items
    set status = p_status
  where order_id = p_order and product_id = p_product;

  if not found then
    raise exception 'ítem no existe en la orden';
  end if;

  v_new := public.recompute_order_status(p_order);
  return v_new;
end;
$$;

revoke all on function public.set_order_item_status(uuid, uuid, text) from public;
grant execute on function public.set_order_item_status(uuid, uuid, text) to authenticated;

-- 5) Marcar todos los ítems activos como preparado (atajo cocina)
create or replace function public.mark_order_items_preparado(p_order uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_ord_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, status into v_rid, v_ord_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_ord_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;

  update public.order_items
    set status = 'preparado'
  where order_id = p_order and status <> 'cancelado';

  return public.recompute_order_status(p_order);
end;
$$;

revoke all on function public.mark_order_items_preparado(uuid) from public;
grant execute on function public.mark_order_items_preparado(uuid) to authenticated;

-- 6) Al enviar a cocina: ítems → pendiente (si no cancelados), orden → cocina
create or replace function public.send_order_to_kitchen(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, status into v_rid, v_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;

  update public.order_items
    set status = 'pendiente'
  where order_id = p_order and status is distinct from 'cancelado';

  update public.orders set status = 'cocina' where id = p_order;
end;
$$;

revoke all on function public.send_order_to_kitchen(uuid) from public;
grant execute on function public.send_order_to_kitchen(uuid) to authenticated;

-- 7) Mesa no disponible / liberar
create or replace function public.set_table_state(
  p_table uuid,
  p_state text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_state not in ('libre', 'ocupada', 'no_disponible') then
    raise exception 'estado de mesa inválido';
  end if;
  select restaurant_id into v_rid from public.dining_tables where id = p_table;
  if v_rid is null then raise exception 'mesa no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  if p_state = 'libre' then
    if exists (
      select 1 from public.orders o
      where o.table_id = p_table and o.status not in ('pagada', 'cancelada')
    ) then
      raise exception 'no se puede liberar: hay orden activa en la mesa';
    end if;
  end if;

  if p_state = 'no_disponible' then
    if exists (
      select 1 from public.orders o
      where o.table_id = p_table and o.status not in ('pagada', 'cancelada')
    ) then
      raise exception 'no se puede marcar no disponible: hay orden activa';
    end if;
  end if;

  update public.dining_tables set state = p_state where id = p_table;
end;
$$;

revoke all on function public.set_table_state(uuid, text) from public;
grant execute on function public.set_table_state(uuid, text) to authenticated;

-- 8) Trigger: nuevos ítems nacen pendiente
create or replace function public.order_items_default_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or new.status = '' then
    new.status := 'pendiente';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_items_status on public.order_items;
create trigger trg_order_items_status
  before insert on public.order_items
  for each row execute function public.order_items_default_status();
