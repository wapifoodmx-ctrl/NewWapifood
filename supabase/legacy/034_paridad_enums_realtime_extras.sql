-- ============================================================
-- 034 — Paridad de esquema con base_actual + adicionales en pedido
-- Idempotente. No borra datos ni módulos.
--
-- Cómo aplicarla (Hugo, a mano):
-- 1. En el SQL Editor del proyecto Supabase de producción, pega este archivo
--    completo y ejecútalo. Se puede correr más de una vez.
-- 2. Hazlo DESPUÉS de desplegar el código de este PR (el menú sigue
--    funcionando si la tabla order_item_extras aún no existe; al revés,
--    el ticket público nuevo espera la función get_public_ticket).
-- 3. No hace falta correr 032: ese archivo no está en el repo. Los casts
--    enum/text viven aquí (write_order_status / write_table_state).
-- 4. Comprueba al final:
--      select enum_range(null::public.order_status);
--      select enum_range(null::public.table_state);
--      select tablename from pg_publication_tables
--        where pubname = 'supabase_realtime'
--          and tablename in ('orders','order_items','dining_tables');
--      select id from storage.buckets where id = 'public-media';
-- ============================================================

-- ---------- Enums (solo si la columna sigue siendo ENUM) ----------
do $$
declare
  v text;
  order_labels text[] := array['abierta','pendiente','cocina','lista','entregada','pagada','cancelada'];
  table_labels text[] := array['libre','ocupada','no_disponible'];
begin
  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'order_status'
  ) then
    foreach v in array order_labels loop
      execute format('alter type public.order_status add value if not exists %L', v);
    end loop;
  end if;

  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'table_state'
  ) then
    foreach v in array table_labels loop
      execute format('alter type public.table_state add value if not exists %L', v);
    end loop;
  end if;
end $$;

-- Motivos de kardex: el dump de producción tipa reason como ENUM.
do $$
declare
  v_type text;
  v_label text;
  labels text[] := array['venta','merma','entrada','ajuste'];
begin
  select t.typname into v_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public'
    and c.relname = 'stock_moves'
    and a.attname = 'reason'
    and not a.attisdropped
    and t.typtype = 'e';

  if v_type is null then
    return;
  end if;

  foreach v_label in array labels loop
    execute format('alter type public.%I add value if not exists %L', v_type, v_label);
  end loop;
end $$;

-- ---------- Columnas que el código ya espera ----------
alter table public.products
  add column if not exists inventory_mode text default 'unitario';

alter table public.ingredients
  add column if not exists is_extra boolean not null default false;

alter table public.ingredients
  add column if not exists kind text default 'no_perecedero';

alter table public.ingredients
  add column if not exists expires_on date;

alter table public.ingredients
  add column if not exists notes text;

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists notes text,
  add column if not exists source text default 'pos',
  add column if not exists order_type text default 'mesa',
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists needs_confirmation boolean default false,
  add column if not exists cancel_reason text,
  add column if not exists public_code text,
  add column if not exists waiter_id uuid,
  add column if not exists payment_method text,
  add column if not exists discount_type text,
  add column if not exists discount_value numeric default 0,
  add column if not exists discount_amount numeric default 0,
  add column if not exists stock_applied boolean not null default false;

alter table public.order_items
  add column if not exists notes text,
  add column if not exists status text default 'pendiente',
  add column if not exists discount_type text,
  add column if not exists discount_value numeric default 0;

alter table public.dining_tables
  add column if not exists channel_type text default 'piso',
  add column if not exists access_pin text;

alter table public.restaurant_profiles
  add column if not exists inventory_pin text,
  add column if not exists delivery_enabled boolean not null default false,
  add column if not exists require_confirm_code boolean not null default true,
  add column if not exists postal_code text,
  add column if not exists confirmation_code text;

alter table public.subscriptions
  add column if not exists billing text default 'mensual';

-- Domicilio puede no tener mesa. En base_actual table_id es NOT NULL.
alter table public.orders alter column table_id drop not null;

alter table public.stock_moves
  add column if not exists restaurant_id uuid,
  add column if not exists order_id uuid,
  add column if not exists note text;

update public.stock_moves sm
set restaurant_id = i.restaurant_id
from public.ingredients i
where sm.ingredient_id = i.id
  and sm.restaurant_id is null;

do $$ begin
  alter table public.orders drop constraint if exists orders_discount_type_check;
  alter table public.orders
    add constraint orders_discount_type_check
    check (discount_type is null or discount_type in ('porcentaje', 'monto'));
exception when others then null;
end $$;

do $$ begin
  alter table public.order_items drop constraint if exists order_items_discount_type_check;
  alter table public.order_items
    add constraint order_items_discount_type_check
    check (discount_type is null or discount_type in ('porcentaje', 'monto'));
exception when others then null;
end $$;

do $$ begin
  alter table public.order_items drop constraint if exists order_items_status_check;
  alter table public.order_items
    add constraint order_items_status_check
    check (status is null or status in ('pendiente', 'preparado', 'cancelado'));
exception when others then null;
end $$;

-- ---------- product_extras (033) y líneas de adicional en la orden ----------
create table if not exists public.product_extras (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  qty numeric not null default 1 check (qty > 0),
  extra_price numeric(12,2) not null default 0,
  primary key (product_id, ingredient_id)
);

create table if not exists public.order_item_extras (
  order_id uuid not null,
  product_id uuid not null,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty numeric not null default 1 check (qty > 0),
  extra_price numeric(12,2) not null default 0,
  primary key (order_id, product_id, ingredient_id),
  foreign key (order_id, product_id)
    references public.order_items(order_id, product_id) on delete cascade
);

alter table public.product_extras enable row level security;
alter table public.order_item_extras enable row level security;
alter table public.ingredients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.dining_tables enable row level security;

drop policy if exists product_extras_select on public.product_extras;
drop policy if exists product_extras_write on public.product_extras;

create policy product_extras_select on public.product_extras
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (public.is_member(p.restaurant_id) or p.active = true)
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

drop policy if exists order_item_extras_member on public.order_item_extras;
create policy order_item_extras_member on public.order_item_extras
  for all to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.is_member(o.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.is_member(o.restaurant_id)
    )
  );

-- El ticket público no lista esta tabla: la lee get_public_ticket (security definer).
drop policy if exists ingredients_public_extras on public.ingredients;
create policy ingredients_public_extras on public.ingredients
  for select to anon
  using (
    coalesce(is_extra, false) = true
    and exists (
      select 1
      from public.product_extras pe
      join public.products p on p.id = pe.product_id
      where pe.ingredient_id = ingredients.id
        and p.active = true
    )
  );

grant select on public.product_extras to anon, authenticated;
grant insert, update, delete on public.product_extras to authenticated;
grant select, insert, update, delete on public.order_item_extras to authenticated;

-- ---------- Realtime ----------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['orders','order_items','dining_tables'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

alter table public.orders replica identity full;
alter table public.order_items replica identity full;
alter table public.dining_tables replica identity full;

-- ---------- Storage public-media ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "public_media_read" on storage.objects;
drop policy if exists "public_media_insert_auth" on storage.objects;
drop policy if exists "public_media_update_auth" on storage.objects;
drop policy if exists "public_media_delete_auth" on storage.objects;

create policy "public_media_read" on storage.objects
  for select to public
  using (bucket_id = 'public-media');

create policy "public_media_insert_auth" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

create policy "public_media_update_auth" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'public-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

create policy "public_media_delete_auth" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

-- ---------- Helpers de tipo (text o enum) ----------
create or replace function public.column_udt(p_table text, p_column text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.typname
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public'
    and c.relname = p_table
    and a.attname = p_column
    and a.attnum > 0
    and not a.attisdropped;
$$;

revoke all on function public.column_udt(text, text) from public;

create or replace function public.write_order_status(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('abierta','pendiente','cocina','lista','entregada','pagada','cancelada') then
    raise exception 'estado de orden inválido: %', p_status;
  end if;

  if public.column_udt('orders', 'status') = 'order_status' then
    execute 'update public.orders set status = $1::public.order_status where id = $2'
      using p_status, p_order;
  else
    update public.orders set status = p_status where id = p_order;
  end if;
end;
$$;

revoke all on function public.write_order_status(uuid, text) from public;

create or replace function public.write_table_state(p_table uuid, p_state text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table is null then
    return;
  end if;
  if p_state not in ('libre','ocupada','no_disponible') then
    raise exception 'estado de mesa inválido: %', p_state;
  end if;

  if public.column_udt('dining_tables', 'state') = 'table_state' then
    execute 'update public.dining_tables set state = $1::public.table_state where id = $2'
      using p_state, p_table;
  else
    update public.dining_tables set state = p_state where id = p_table;
  end if;
end;
$$;

revoke all on function public.write_table_state(uuid, text) from public;

create or replace function public.record_stock_move(
  p_restaurant uuid,
  p_ingredient uuid,
  p_order uuid,
  p_qty numeric,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_udt text;
  v_reason text;
  v_note text;
  v_is_enum boolean;
  v_label_ok boolean;
begin
  v_udt := public.column_udt('stock_moves', 'reason');
  v_reason := coalesce(nullif(trim(p_reason), ''), 'ajuste');
  v_note := nullif(trim(coalesce(p_note, '')), '');

  select exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = v_udt and t.typtype = 'e'
  ) into v_is_enum;

  if v_is_enum then
    select exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = v_udt and e.enumlabel = v_reason
    ) into v_label_ok;

    if not v_label_ok then
      v_note := coalesce(v_note, v_reason);
      if p_qty < 0 and exists (
        select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = v_udt and e.enumlabel = 'venta'
      ) then
        v_reason := 'venta';
      elsif p_qty < 0 and exists (
        select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = v_udt and e.enumlabel = 'merma'
      ) then
        v_reason := 'merma';
      elsif exists (
        select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = v_udt and e.enumlabel = 'entrada'
      ) then
        v_reason := 'entrada';
      elsif exists (
        select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = v_udt and e.enumlabel = 'ajuste'
      ) then
        v_reason := 'ajuste';
      else
        select e.enumlabel into v_reason
        from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = v_udt
        order by e.enumsortorder
        limit 1;
      end if;
    end if;

    execute format(
      'insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
       values ($1, $2, $3, $4, $5::public.%I, $6)',
      v_udt
    )
    using p_restaurant, p_ingredient, p_order, p_qty, v_reason, v_note;
  else
    insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
    values (p_restaurant, p_ingredient, p_order, p_qty, v_reason, v_note);
  end if;
end;
$$;

revoke all on function public.record_stock_move(uuid, uuid, uuid, numeric, text, text) from public;

-- ---------- Onboarding (sin semillas de negocio) ----------
create or replace function public.create_my_restaurant(p_name text default 'Mi restaurante')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then
    raise exception 'no autenticado';
  end if;

  select restaurant_id into v_rid
  from public.memberships
  where user_id = v_uid
  limit 1;

  if v_rid is not null then
    return v_rid;
  end if;

  if v_name is null then
    v_name := 'Mi restaurante';
  end if;

  insert into public.restaurants (name)
  values (v_name)
  returning id into v_rid;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_rid, v_uid, 'owner');

  insert into public.subscriptions (
    restaurant_id, plan, status, amount, billing, provider, ends_at
  ) values (
    v_rid, 'ventas', 'trialing', 0, 'mensual', 'trial', now() + interval '14 days'
  );

  insert into public.restaurant_profiles (
    restaurant_id, confirmation_code, require_confirm_code, delivery_enabled
  ) values (
    v_rid,
    lpad((floor(random() * 10000))::int::text, 4, '0'),
    true,
    false
  )
  on conflict (restaurant_id) do nothing;

  return v_rid;
end;
$$;

revoke all on function public.create_my_restaurant(text) from public;
grant execute on function public.create_my_restaurant(text) to authenticated;

create or replace function public.can_operate(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.restaurant_id = p_restaurant
      and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

revoke all on function public.can_operate(uuid) from public;
grant execute on function public.can_operate(uuid) to anon, authenticated;

-- ---------- Inventario unitario ----------
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

  insert into public.recipe_lines (product_id, ingredient_id, qty)
  values (p_product, v_ing, 1)
  on conflict (product_id, ingredient_id) do update set qty = 1;

  delete from public.recipe_lines
  where product_id = p_product and ingredient_id <> v_ing;

  update public.products set inventory_mode = 'unitario' where id = p_product;

  return v_ing;
end;
$$;

revoke all on function public.ensure_unit_product_inventory(uuid, numeric, numeric, text) from public;
grant execute on function public.ensure_unit_product_inventory(uuid, numeric, numeric, text) to authenticated;

-- ---------- Estados ----------
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
  select status::text, table_id into v_status, v_table
  from public.orders where id = p_order;

  if v_status is null then
    raise exception 'orden no existe';
  end if;

  if v_status in ('pagada', 'cancelada') then
    return v_status;
  end if;

  if v_status = 'pendiente' then
    return v_status;
  end if;

  select
    count(*) filter (where coalesce(status, 'pendiente') <> 'cancelado'),
    count(*) filter (where coalesce(status, 'pendiente') = 'pendiente'),
    count(*) filter (where status = 'preparado')
  into v_active, v_pend, v_prep
  from public.order_items
  where order_id = p_order;

  if v_active = 0 then
    perform public.write_order_status(p_order, 'cancelada');
    update public.orders set closed_at = coalesce(closed_at, now()) where id = p_order;
    if v_table is not null and not exists (
      select 1 from public.orders o
      where o.table_id = v_table and o.id <> p_order
        and o.status::text not in ('pagada', 'cancelada')
    ) then
      if (select state::text from public.dining_tables where id = v_table) is distinct from 'no_disponible' then
        perform public.write_table_state(v_table, 'libre');
      end if;
    end if;
    return 'cancelada';
  end if;

  if v_pend = 0 and v_prep = v_active then
    perform public.write_order_status(p_order, 'lista');
    return 'lista';
  end if;

  if v_status in ('lista', 'entregada', 'cocina', 'abierta') then
    perform public.write_order_status(p_order, 'cocina');
    return 'cocina';
  end if;

  return v_status;
end;
$$;

revoke all on function public.recompute_order_status(uuid) from public;
grant execute on function public.recompute_order_status(uuid) to authenticated;

create or replace function public.set_order_status(p_order uuid, p_status text)
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
  if p_status not in ('pendiente', 'cocina', 'lista', 'entregada', 'abierta') then
    raise exception 'estado inválido';
  end if;
  select restaurant_id, status::text into v_rid, v_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;
  perform public.write_order_status(p_order, p_status);
end;
$$;

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;

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
  select restaurant_id, status::text into v_rid, v_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;

  update public.order_items
    set status = 'pendiente'
  where order_id = p_order and status is distinct from 'cancelado';

  perform public.write_order_status(p_order, 'cocina');
end;
$$;

revoke all on function public.send_order_to_kitchen(uuid) from public;
grant execute on function public.send_order_to_kitchen(uuid) to authenticated;

create or replace function public.set_table_state(p_table uuid, p_state text)
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

  if p_state in ('libre', 'no_disponible') then
    if exists (
      select 1 from public.orders o
      where o.table_id = p_table and o.status::text not in ('pagada', 'cancelada')
    ) then
      raise exception 'hay una orden activa en la mesa';
    end if;
  end if;

  perform public.write_table_state(p_table, p_state);
end;
$$;

revoke all on function public.set_table_state(uuid, text) from public;
grant execute on function public.set_table_state(uuid, text) to authenticated;

create or replace function public.cancel_order(p_order uuid, p_reason text default 'cancelada por el local')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_table uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, table_id, status::text into v_rid, v_table, v_status
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'la orden ya está cerrada'; end if;

  perform public.write_order_status(p_order, 'cancelada');
  update public.orders
    set cancel_reason = coalesce(nullif(trim(p_reason), ''), 'cancelada por el local'),
        closed_at = now()
  where id = p_order;

  if v_table is not null and not exists (
    select 1 from public.orders o
    where o.table_id = v_table and o.id <> p_order
      and o.status::text not in ('pagada', 'cancelada')
  ) then
    if (select state::text from public.dining_tables where id = v_table) is distinct from 'no_disponible' then
      perform public.write_table_state(v_table, 'libre');
    end if;
  end if;
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- ---------- Cierre: receta + adicionales. No descuenta modo none ----------
create or replace function public.close_order(
  p_order uuid,
  p_method text default 'efectivo'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
  v_table uuid;
  v_applied boolean;
  r record;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;

  select restaurant_id, status::text, table_id, coalesce(stock_applied, false)
    into v_rid, v_status, v_table, v_applied
  from public.orders where id = p_order;

  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden ya cerrada'; end if;

  if not v_applied then
    for r in
      select rl.ingredient_id, sum(rl.qty * oi.qty) as need
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.recipe_lines rl on rl.product_id = oi.product_id
      where oi.order_id = p_order
        and coalesce(oi.status, 'pendiente') <> 'cancelado'
        and coalesce(p.inventory_mode, 'unitario') <> 'none'
      group by rl.ingredient_id
    loop
      update public.ingredients
        set stock = greatest(0, stock - r.need)
      where id = r.ingredient_id and restaurant_id = v_rid;

      perform public.record_stock_move(v_rid, r.ingredient_id, p_order, -r.need, 'venta', 'venta');
    end loop;

    for r in
      select x.ingredient_id, sum(x.qty * oi.qty) as need
      from public.order_item_extras x
      join public.order_items oi
        on oi.order_id = x.order_id and oi.product_id = x.product_id
      where x.order_id = p_order
        and coalesce(oi.status, 'pendiente') <> 'cancelado'
      group by x.ingredient_id
    loop
      update public.ingredients
        set stock = greatest(0, stock - r.need)
      where id = r.ingredient_id and restaurant_id = v_rid;

      perform public.record_stock_move(v_rid, r.ingredient_id, p_order, -r.need, 'venta', 'adicional');
    end loop;
  end if;

  perform public.write_order_status(p_order, 'pagada');
  update public.orders
    set closed_at = now(),
        payment_method = coalesce(nullif(trim(p_method), ''), 'efectivo'),
        stock_applied = true
  where id = p_order;

  if v_table is not null and not exists (
    select 1 from public.orders o
    where o.table_id = v_table and o.id <> p_order
      and o.status::text not in ('pagada', 'cancelada')
  ) then
    if (select state::text from public.dining_tables where id = v_table) is distinct from 'no_disponible' then
      perform public.write_table_state(v_table, 'libre');
    end if;
  end if;
end;
$$;

revoke all on function public.close_order(uuid, text) from public;
grant execute on function public.close_order(uuid, text) to authenticated;

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
  update public.ingredients set stock = stock + p_qty where id = p_ingredient;
  perform public.record_stock_move(v_rid, p_ingredient, null, p_qty, 'entrada', coalesce(nullif(trim(p_note), ''), 'entrada'));
end;
$$;

revoke all on function public.register_entrada(uuid, numeric, text) from public;
grant execute on function public.register_entrada(uuid, numeric, text) to authenticated;

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
  update public.ingredients set stock = greatest(0, stock - p_qty) where id = p_ingredient;
  perform public.record_stock_move(v_rid, p_ingredient, null, -p_qty, 'merma', coalesce(nullif(trim(p_note), ''), 'merma'));
end;
$$;

revoke all on function public.register_merma(uuid, numeric, text) from public;
grant execute on function public.register_merma(uuid, numeric, text) to authenticated;

-- ---------- Pedido público con adicionales ----------
create or replace function public.place_public_order(
  p_restaurant uuid,
  p_table uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_notes text default null,
  p_confirm_code text default null,
  p_source text default 'web_menu',
  p_order_type text default 'mesa',
  p_customer_phone text default null,
  p_delivery_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_item jsonb;
  v_ex jsonb;
  v_pid uuid;
  v_ing uuid;
  v_qty numeric;
  v_price numeric;
  v_status text;
  v_need_code boolean;
  v_code text;
  v_extra_qty numeric;
  v_extra_price numeric;
  v_item_notes text;
  v_source text;
  v_type text;
begin
  if p_restaurant is null then raise exception 'restaurante requerido'; end if;
  if not public.can_operate(p_restaurant) then
    raise exception 'el restaurante no tiene un plan activo';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito vacío';
  end if;

  v_source := coalesce(nullif(trim(p_source), ''), 'web_menu');
  v_type := coalesce(nullif(trim(p_order_type), ''), 'mesa');
  if v_source not in ('pos','mesero','tablet','kiosko','web_menu') then
    v_source := 'web_menu';
  end if;
  if v_type not in ('mesa','domicilio') then
    v_type := 'mesa';
  end if;

  if v_type = 'mesa' and p_table is null then
    raise exception 'mesa requerida';
  end if;

  if p_table is not null then
    if not exists (
      select 1 from public.dining_tables t
      where t.id = p_table and t.restaurant_id = p_restaurant and t.active = true
        and t.state::text <> 'no_disponible'
    ) then
      raise exception 'mesa inválida o no disponible';
    end if;
  end if;

  select coalesce(require_confirm_code, false), confirmation_code
    into v_need_code, v_code
  from public.restaurant_profiles
  where restaurant_id = p_restaurant;

  if v_source = 'web_menu' and v_type = 'mesa' and v_need_code then
    if p_confirm_code is null or trim(p_confirm_code) <> coalesce(v_code, '') then
      raise exception 'código de confirmación inválido';
    end if;
  end if;

  if v_type = 'domicilio' then
    v_status := 'pendiente';
  elsif v_source = 'web_menu' and coalesce(v_need_code, false) then
    v_status := 'cocina';
  else
    v_status := 'cocina';
  end if;

  insert into public.orders (
    restaurant_id, table_id, source, order_type,
    customer_name, notes, customer_phone, delivery_address, needs_confirmation
  ) values (
    p_restaurant,
    p_table,
    v_source,
    v_type,
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_notes), ''),
    nullif(trim(p_customer_phone), ''),
    case when v_type = 'domicilio' then nullif(trim(p_delivery_address), '') else null end,
    (v_status = 'pendiente')
  )
  returning id into v_order;

  perform public.write_order_status(v_order, v_status);

  if p_table is not null and v_status <> 'pendiente' then
    perform public.write_table_state(p_table, 'ocupada');
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'qty')::numeric, 1));
    v_item_notes := nullif(trim(v_item->>'notes'), '');

    select price into v_price
    from public.products
    where id = v_pid and restaurant_id = p_restaurant and active = true;
    if v_price is null then
      raise exception 'producto inválido';
    end if;

    insert into public.order_items (order_id, product_id, qty, unit_price, status, notes)
    values (v_order, v_pid, v_qty, v_price, 'pendiente', v_item_notes)
    on conflict (order_id, product_id) do update
      set qty = public.order_items.qty + excluded.qty,
          notes = coalesce(excluded.notes, public.order_items.notes),
          status = case
            when public.order_items.status = 'cancelado' then 'pendiente'
            else public.order_items.status
          end;

    if v_item ? 'extras' and jsonb_typeof(v_item->'extras') = 'array' then
      for v_ex in select * from jsonb_array_elements(v_item->'extras')
      loop
        v_ing := (v_ex->>'ingredient_id')::uuid;
        v_extra_qty := null;
        v_extra_price := null;
        select pe.qty, pe.extra_price
          into v_extra_qty, v_extra_price
        from public.product_extras pe
        join public.ingredients i on i.id = pe.ingredient_id
        where pe.product_id = v_pid
          and pe.ingredient_id = v_ing
          and i.restaurant_id = p_restaurant
          and coalesce(i.is_extra, false) = true;
        if not found then
          continue;
        end if;
        insert into public.order_item_extras (order_id, product_id, ingredient_id, qty, extra_price)
        values (v_order, v_pid, v_ing, v_extra_qty, v_extra_price)
        on conflict (order_id, product_id, ingredient_id) do update
          set qty = excluded.qty,
              extra_price = excluded.extra_price;
      end loop;
    end if;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) to anon, authenticated;

-- Ticket público de una sola orden (no lista el restaurante entero).
create or replace function public.get_public_ticket(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if p_order is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'status', o.status::text,
    'public_code', o.public_code,
    'cancel_reason', o.cancel_reason,
    'restaurant_name', r.name,
    'table_number', t.number,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', oi.product_id,
        'name', p.name,
        'qty', oi.qty,
        'unit_price', oi.unit_price,
        'status', coalesce(oi.status, 'pendiente'),
        'notes', oi.notes,
        'extras', coalesce((
          select jsonb_agg(jsonb_build_object(
            'ingredient_id', x.ingredient_id,
            'name', i.name,
            'qty', x.qty,
            'extra_price', x.extra_price
          ) order by i.name)
          from public.order_item_extras x
          join public.ingredients i on i.id = x.ingredient_id
          where x.order_id = oi.order_id and x.product_id = oi.product_id
        ), '[]'::jsonb)
      ) order by p.name)
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  into v
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.dining_tables t on t.id = o.table_id
  where o.id = p_order;

  return v;
end;
$$;

revoke all on function public.get_public_ticket(uuid) from public;
grant execute on function public.get_public_ticket(uuid) to anon, authenticated;
