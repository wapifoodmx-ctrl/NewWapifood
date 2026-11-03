-- Fase 3: PIN inventario + entradas formales + kardex legible

alter table public.restaurant_profiles
  add column if not exists inventory_pin text;

-- Entrada de stock (espejo de merma)
create or replace function public.register_entrada(
  p_ingredient uuid,
  p_qty numeric,
  p_note text default 'entrada'
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
  if p_qty is null or p_qty <= 0 then raise exception 'cantidad inválida'; end if;

  select restaurant_id into v_rid from public.ingredients where id = p_ingredient;
  if v_rid is null then raise exception 'insumo no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  update public.ingredients
    set stock = stock + p_qty
  where id = p_ingredient;

  insert into public.stock_moves (ingredient_id, qty, reason)
  values (p_ingredient, p_qty, coalesce(nullif(trim(p_note), ''), 'entrada'));
end;
$$;

revoke all on function public.register_entrada(uuid, numeric, text) from public;
grant execute on function public.register_entrada(uuid, numeric, text) to authenticated;

-- Asegurar register_merma existe (idempotente)
create or replace function public.register_merma(
  p_ingredient uuid,
  p_qty numeric,
  p_note text default 'merma'
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
  if p_qty is null or p_qty <= 0 then raise exception 'cantidad inválida'; end if;

  select restaurant_id into v_rid from public.ingredients where id = p_ingredient;
  if v_rid is null then raise exception 'insumo no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  update public.ingredients
    set stock = greatest(0, stock - p_qty)
  where id = p_ingredient;

  insert into public.stock_moves (ingredient_id, qty, reason)
  values (p_ingredient, -p_qty, coalesce(nullif(trim(p_note), ''), 'merma'));
end;
$$;

revoke all on function public.register_merma(uuid, numeric, text) from public;
grant execute on function public.register_merma(uuid, numeric, text) to authenticated;
