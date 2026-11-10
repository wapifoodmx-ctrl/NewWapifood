-- Proveedores y compras. El costo guardado es el de la última compra,
-- en la misma unidad del inventario (gramos, mililitros o piezas).
-- El margen de la receta ya es precio menos cantidad × ingredients.cost.
-- No promedia costos ni inventa otra regla.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_restaurant_idx
  on public.suppliers (restaurant_id, name);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  note text,
  total numeric(12,2) not null default 0,
  bought_at timestamptz not null default now()
);

create index if not exists purchases_restaurant_idx
  on public.purchases (restaurant_id, bought_at desc);

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  qty numeric not null check (qty > 0),
  unit_cost numeric(12,4) not null check (unit_cost >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);

create index if not exists purchase_lines_purchase_idx
  on public.purchase_lines (purchase_id);

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_lines enable row level security;

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated
  using (public.is_member(restaurant_id));

drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases
  for select to authenticated
  using (public.is_member(restaurant_id));

drop policy if exists purchase_lines_select on public.purchase_lines;
create policy purchase_lines_select on public.purchase_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.purchases p
      where p.id = purchase_id and public.is_member(p.restaurant_id)
    )
  );

revoke all on table public.suppliers from public, anon, authenticated;
revoke all on table public.purchases from public, anon, authenticated;
revoke all on table public.purchase_lines from public, anon, authenticated;
grant select on table public.suppliers to authenticated;
grant select on table public.purchases to authenticated;
grant select on table public.purchase_lines to authenticated;

create or replace function public.save_supplier(
  p_restaurant uuid,
  p_name text,
  p_phone text default null,
  p_notes text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'el proveedor necesita un nombre';
  end if;
  if p_id is null then
    insert into public.suppliers (restaurant_id, name, phone, notes)
    values (p_restaurant, trim(p_name), nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_notes, '')), ''))
    returning id into v_id;
  else
    update public.suppliers
      set name = trim(p_name),
          phone = nullif(trim(coalesce(p_phone, '')), ''),
          notes = nullif(trim(coalesce(p_notes, '')), '')
    where id = p_id and restaurant_id = p_restaurant
    returning id into v_id;
    if v_id is null then raise exception 'ese proveedor no es de este local'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.record_purchase(
  p_restaurant uuid,
  p_supplier uuid,
  p_note text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_total numeric(12,2) := 0;
  row jsonb;
  v_ing uuid;
  v_qty numeric;
  v_cost numeric;
  v_line numeric(12,2);
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  if p_supplier is not null and not exists (
    select 1 from public.suppliers
    where id = p_supplier and restaurant_id = p_restaurant
  ) then
    raise exception 'ese proveedor no es de este local';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'la compra necesita al menos un insumo';
  end if;

  insert into public.purchases (restaurant_id, supplier_id, note)
  values (p_restaurant, p_supplier, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  for row in select * from jsonb_array_elements(p_lines)
  loop
    v_ing := nullif(row->>'ingredient_id', '')::uuid;
    v_qty := (row->>'qty')::numeric;
    v_cost := coalesce((row->>'unit_cost')::numeric, 0);
    if v_qty is null or v_qty <= 0 then raise exception 'cantidad inválida'; end if;
    if v_cost < 0 then raise exception 'el costo no puede ser negativo'; end if;
    if not exists (
      select 1 from public.ingredients
      where id = v_ing and restaurant_id = p_restaurant
    ) then
      raise exception 'ese insumo no es de este local';
    end if;
    v_line := round(v_qty * v_cost, 2);
    insert into public.purchase_lines (purchase_id, ingredient_id, qty, unit_cost, line_total)
    values (v_id, v_ing, v_qty, v_cost, v_line);
    perform public.register_entrada(v_ing, v_qty, 'compra');
    update public.ingredients set cost = v_cost where id = v_ing;
    v_total := v_total + v_line;
  end loop;

  update public.purchases set total = v_total where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.save_supplier(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.save_supplier(uuid, text, text, text, uuid) to authenticated;
revoke all on function public.record_purchase(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_purchase(uuid, uuid, text, jsonb) to authenticated;
