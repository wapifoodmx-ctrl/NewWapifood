-- Inventario unitario + receta + adicionales (paridad WapifoodFront)

alter table public.products
  add column if not exists inventory_mode text default 'unitario';

-- unitario = 1 insumo 1:1 (refresco)
-- receta   = varios insumos (taco)
-- none     = no descuenta stock

comment on column public.products.inventory_mode is 'unitario | receta | none';

alter table public.ingredients
  add column if not exists is_extra boolean not null default false;

comment on column public.ingredients.is_extra is 'true = adicional vendible en menú (queso, crema, etc.)';

-- Extras por producto (adicionales opcionales al pedir)
create table if not exists public.product_extras (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  qty numeric not null default 1 check (qty > 0),
  extra_price numeric(12,2) not null default 0,
  primary key (product_id, ingredient_id)
);

alter table public.product_extras enable row level security;

drop policy if exists product_extras_select on public.product_extras;
drop policy if exists product_extras_write on public.product_extras;

create policy product_extras_select on public.product_extras
  for select to authenticated, anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (
        public.is_member(p.restaurant_id)
        or true  -- lectura pública para menú
      )
    )
  );

create policy product_extras_write on public.product_extras
  for all to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_member(p.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_member(p.restaurant_id)
    )
  );

grant select, insert, update, delete on public.product_extras to authenticated;
grant select on public.product_extras to anon;

-- Helper: asegurar insumo unitario 1:1 y línea de receta qty=1
create or replace function public.ensure_unit_product_inventory(
  p_product uuid,
  p_stock numeric default 0,
  p_min_stock numeric default 0,
  p_unit text default 'pza'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_name text;
  v_ing uuid;
  v_unit text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;

  select restaurant_id, name into v_rid, v_name
  from public.products where id = p_product;
  if v_rid is null then raise exception 'producto no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;

  v_unit := coalesce(nullif(trim(p_unit), ''), 'pza');

  -- Buscar insumo ya vinculado por receta de 1 línea o por nombre
  select rl.ingredient_id into v_ing
  from public.recipe_lines rl
  where rl.product_id = p_product
  limit 1;

  if v_ing is null then
    select i.id into v_ing
    from public.ingredients i
    where i.restaurant_id = v_rid and lower(i.name) = lower(v_name)
    limit 1;
  end if;

  if v_ing is null then
    insert into public.ingredients (restaurant_id, name, unit, stock, min_stock, kind, is_extra)
    values (v_rid, v_name, v_unit, coalesce(p_stock, 0), coalesce(p_min_stock, 0), 'no_perecedero', false)
    returning id into v_ing;
  else
    update public.ingredients
      set stock = coalesce(p_stock, stock),
          min_stock = coalesce(p_min_stock, min_stock),
          unit = v_unit,
          is_extra = false
    where id = v_ing;
  end if;

  -- Receta unitaria: 1 unidad de ese insumo por producto vendido
  insert into public.recipe_lines (product_id, ingredient_id, qty)
  values (p_product, v_ing, 1)
  on conflict (product_id, ingredient_id) do update set qty = 1;

  -- Limpiar otras líneas si era receta multi (modo unitario = un solo insumo)
  delete from public.recipe_lines
  where product_id = p_product and ingredient_id <> v_ing;

  update public.products set inventory_mode = 'unitario' where id = p_product;

  return v_ing;
end;
$$;

revoke all on function public.ensure_unit_product_inventory(uuid, numeric, numeric, text) from public;
grant execute on function public.ensure_unit_product_inventory(uuid, numeric, numeric, text) to authenticated;
