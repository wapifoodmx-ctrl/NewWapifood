-- Seguridad, índices y adicionales.
-- Idempotente. Corre en producción después de marcar la baseline como aplicada.
-- order_items sigue con PK (order_id, product_id): un producto no se repite en la orden.
-- Los adicionales van en order_item_extras (cantidad y precio por unidad del producto).

alter table public.stock_moves add column if not exists note text;

do $$ begin
  alter table public.orders
    add constraint orders_waiter_id_fkey
    foreign key (waiter_id) references public.waiters(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists orders_waiter_id_idx on public.orders (waiter_id);
create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_restaurant_id_idx on public.products (restaurant_id);
create index if not exists recipe_lines_ingredient_id_idx on public.recipe_lines (ingredient_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists stock_moves_ingredient_id_idx on public.stock_moves (ingredient_id);
create index if not exists stock_moves_order_id_idx on public.stock_moves (order_id);
create index if not exists stock_moves_restaurant_id_idx on public.stock_moves (restaurant_id);
create index if not exists waiter_tables_table_id_idx on public.waiter_tables (table_id);
create index if not exists web_orders_order_id_idx on public.web_orders (order_id);
create index if not exists web_orders_restaurant_id_idx on public.web_orders (restaurant_id);
create index if not exists product_images_product_id_idx on public.product_images (product_id);
create index if not exists product_extras_ingredient_id_idx on public.product_extras (ingredient_id);

create table if not exists public.order_item_extras (
  order_id uuid not null,
  product_id uuid not null,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty numeric not null default 1 check (qty > 0),
  extra_price numeric(12,2) not null default 0,
  primary key (order_id, product_id, ingredient_id),
  foreign key (order_id, product_id) references public.order_items (order_id, product_id) on delete cascade
);

create index if not exists order_item_extras_ingredient_id_idx on public.order_item_extras (ingredient_id);
alter table public.order_item_extras enable row level security;

drop policy if exists order_item_extras_member on public.order_item_extras;
create policy order_item_extras_member on public.order_item_extras
  for all to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and public.is_member(o.restaurant_id)
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id and public.is_member(o.restaurant_id)
  ));

grant select, insert, update, delete on public.order_item_extras to authenticated;

-- Políticas: (select auth.uid()) se evalúa una vez por consulta, no por fila.
drop policy if exists memberships_self on public.memberships;
create policy memberships_self on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists restaurant_profiles_select on public.restaurant_profiles;
create policy restaurant_profiles_select on public.restaurant_profiles
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.restaurant_id = restaurant_profiles.restaurant_id
      and m.user_id = (select auth.uid())
  ));

drop policy if exists restaurant_profiles_write on public.restaurant_profiles;
create policy restaurant_profiles_write on public.restaurant_profiles
  for all to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.restaurant_id = restaurant_profiles.restaurant_id
      and m.user_id = (select auth.uid())
      and m.role::text = any (array['owner','admin'])
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.restaurant_id = restaurant_profiles.restaurant_id
      and m.user_id = (select auth.uid())
      and m.role::text = any (array['owner','admin'])
  ));

drop policy if exists restaurants_member_update on public.restaurants;
create policy restaurants_member_update on public.restaurants
  for update to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.restaurant_id = restaurants.id
      and m.user_id = (select auth.uid())
      and m.role::text = any (array['owner','admin'])
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.restaurant_id = restaurants.id
      and m.user_id = (select auth.uid())
      and m.role::text = any (array['owner','admin'])
  ));

drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert to authenticated
  with check (exists (
    select 1 from public.memberships m
    where m.restaurant_id = subscriptions.restaurant_id
      and m.user_id = (select auth.uid())
      and m.role::text = any (array['owner','admin'])
  ));

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.restaurant_id = subscriptions.restaurant_id
      and m.user_id = (select auth.uid())
  ));

-- Duplicados permisivos que no aportan y, en storage, abren el bucket a cualquier autenticado.
drop policy if exists ingredients_select on public.ingredients;
drop policy if exists "public_media_delete" on storage.objects;
drop policy if exists "public_media_insert" on storage.objects;
drop policy if exists "public_media_update" on storage.objects;

drop policy if exists "public_media_update_auth" on storage.objects;
create policy "public_media_update_auth" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and public.is_member((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'public-media' and public.is_member((storage.foldername(name))[1]::uuid));

drop policy if exists product_extras_select on public.product_extras;
create policy product_extras_select on public.product_extras
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_extras.product_id
      and (public.is_member(p.restaurant_id) or p.active = true)
  ));

-- ---------- Funciones ----------
create or replace function public.order_subtotal(p_order uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    greatest(0,
      ((oi.unit_price + coalesce(ex.extra_sum, 0)) * oi.qty)
      - case
          when oi.discount_type = 'porcentaje'
            then ((oi.unit_price + coalesce(ex.extra_sum, 0)) * oi.qty) * coalesce(oi.discount_value, 0) / 100
          when oi.discount_type = 'monto' then coalesce(oi.discount_value, 0)
          else 0
        end
    )
  ), 0)
  from public.order_items oi
  left join (
    select order_id, product_id, sum(extra_price) as extra_sum
    from public.order_item_extras
    group by order_id, product_id
  ) ex on ex.order_id = oi.order_id and ex.product_id = oi.product_id
  where oi.order_id = p_order
    and coalesce(oi.status, 'pendiente') <> 'cancelado';
$$;

create or replace function public.close_order(p_order uuid, p_method text default 'efectivo')
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
  v_method text;
  r record;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, status::text, table_id, coalesce(stock_applied, false)
    into v_rid, v_status, v_table, v_applied
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden ya cerrada'; end if;

  v_method := coalesce(nullif(trim(p_method), ''), 'efectivo');
  if v_method not in ('efectivo', 'tarjeta', 'transferencia') then
    raise exception 'método de pago inválido';
  end if;

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
      insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
      values (v_rid, r.ingredient_id, p_order, -r.need, 'venta', 'venta');
    end loop;

    for r in
      select x.ingredient_id, sum(x.qty * oi.qty) as need
      from public.order_item_extras x
      join public.order_items oi on oi.order_id = x.order_id and oi.product_id = x.product_id
      where x.order_id = p_order
        and coalesce(oi.status, 'pendiente') <> 'cancelado'
      group by x.ingredient_id
    loop
      update public.ingredients
        set stock = greatest(0, stock - r.need)
      where id = r.ingredient_id and restaurant_id = v_rid;
      insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
      values (v_rid, r.ingredient_id, p_order, -r.need, 'venta', 'adicional');
    end loop;
  end if;

  update public.orders
    set status = 'pagada'::public.order_status,
        method = v_method::public.pay_method,
        payment_method = v_method,
        closed_at = now(),
        stock_applied = true
  where id = p_order;

  if v_table is not null and not exists (
    select 1 from public.orders o
    where o.table_id = v_table and o.id <> p_order
      and o.status::text not in ('pagada', 'cancelada')
  ) and (select state::text from public.dining_tables where id = v_table) is distinct from 'no_disponible' then
    update public.dining_tables set state = 'libre'::public.table_state where id = v_table;
  end if;
end;
$$;

drop function if exists public.close_order(uuid, public.pay_method);

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
  v_qty integer;
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
  if p_table is not null and not exists (
    select 1 from public.dining_tables t
    where t.id = p_table and t.restaurant_id = p_restaurant and t.active = true
      and t.state::text <> 'no_disponible'
  ) then
    raise exception 'mesa inválida o no disponible';
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

  v_status := case when v_type = 'domicilio' then 'pendiente' else 'cocina' end;

  insert into public.orders (
    restaurant_id, table_id, status, source, order_type,
    customer_name, notes, customer_phone, delivery_address, needs_confirmation
  ) values (
    p_restaurant,
    p_table,
    v_status::public.order_status,
    v_source,
    v_type,
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_notes), ''),
    nullif(trim(p_customer_phone), ''),
    case when v_type = 'domicilio' then nullif(trim(p_delivery_address), '') else null end,
    v_status = 'pendiente'
  )
  returning id into v_order;

  if p_table is not null and v_status <> 'pendiente' then
    update public.dining_tables set state = 'ocupada'::public.table_state where id = p_table;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'qty')::int, 1));
    v_item_notes := nullif(trim(coalesce(v_item->>'notes', v_item->>'note')), '');
    select price into v_price
    from public.products
    where id = v_pid and restaurant_id = p_restaurant and active = true;
    if v_price is null then raise exception 'producto inválido'; end if;

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
        v_ing := nullif(v_ex->>'ingredient_id', '')::uuid;
        v_extra_qty := null;
        v_extra_price := null;
        select pe.qty, pe.extra_price into v_extra_qty, v_extra_price
        from public.product_extras pe
        join public.ingredients i on i.id = pe.ingredient_id
        where pe.product_id = v_pid
          and pe.ingredient_id = v_ing
          and i.restaurant_id = p_restaurant
          and coalesce(i.is_extra, false) = true;
        if not found then continue; end if;
        insert into public.order_item_extras (order_id, product_id, ingredient_id, qty, extra_price)
        values (v_order, v_pid, v_ing, v_extra_qty, v_extra_price)
        on conflict (order_id, product_id, ingredient_id) do update
          set qty = excluded.qty, extra_price = excluded.extra_price;
      end loop;
    end if;
  end loop;

  return v_order;
end;
$$;

drop function if exists public.place_public_order(uuid, uuid, jsonb, text, text);
drop function if exists public.place_public_order(uuid, uuid, jsonb, text, text, text);
drop function if exists public.place_public_order(uuid, uuid, jsonb, text, text, text, text);

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
  insert into public.stock_moves (restaurant_id, ingredient_id, qty, reason, note)
  values (v_rid, p_ingredient, p_qty, 'entrada', coalesce(nullif(trim(p_note), ''), 'entrada'));
end;
$$;

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
  insert into public.stock_moves (restaurant_id, ingredient_id, qty, reason, note)
  values (v_rid, p_ingredient, -p_qty, 'merma', coalesce(nullif(trim(p_note), ''), 'merma'));
end;
$$;

create or replace function public.activate_plan(
  p_restaurant uuid,
  p_plan text,
  p_billing text default 'mensual',
  p_provider text default 'mercadopago',
  p_provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(10,2);
  v_days int;
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'activar plan solo desde el webhook';
  end if;
  if p_plan not in ('ventas', 'restaurante', 'plus') then
    raise exception 'plan inválido';
  end if;
  if coalesce(p_billing, 'mensual') = 'anual' then
    v_days := 365;
    v_amount := case p_plan when 'ventas' then 4000 when 'restaurante' then 6000 else 8000 end;
  else
    v_days := 30;
    v_amount := case p_plan when 'ventas' then 400 when 'restaurante' then 600 else 800 end;
  end if;
  insert into public.subscriptions (
    restaurant_id, plan, status, amount, billing, provider, provider_ref, ends_at
  ) values (
    p_restaurant, p_plan, 'active', v_amount, coalesce(p_billing, 'mensual'),
    coalesce(p_provider, 'mercadopago'), p_provider_ref, now() + make_interval(days => v_days)
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_order_waiter(p_order uuid, p_waiter uuid, p_code text)
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
    where w.id = p_waiter and w.restaurant_id = v_rid and w.active = true and w.access_code = trim(p_code)
  ) into v_ok;
  if not v_ok then raise exception 'mesero o código inválido'; end if;
  update public.orders set waiter_id = p_waiter where id = p_order;
end;
$$;

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
  if p_order is null then return null; end if;
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
  ) into v
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.dining_tables t on t.id = o.table_id
  where o.id = p_order;
  return v;
end;
$$;

create or replace function public.can_operate(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.restaurant_id = p_restaurant and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

create or replace function public.create_my_restaurant(p_name text default 'Mi restaurante')
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select restaurant_id into v_rid from public.memberships where user_id = v_uid limit 1;
  if v_rid is not null then return v_rid; end if;
  if v_name is null then v_name := 'Mi restaurante'; end if;
  insert into public.restaurants (name) values (v_name) returning id into v_rid;
  insert into public.memberships (restaurant_id, user_id, role) values (v_rid, v_uid, 'owner');
  insert into public.subscriptions (restaurant_id, plan, status, amount, billing, provider, ends_at)
  values (v_rid, 'ventas', 'trialing', 0, 'mensual', 'trial', now() + interval '14 days');
  insert into public.restaurant_profiles (restaurant_id, confirmation_code, require_confirm_code, delivery_enabled)
  values (v_rid, lpad((floor(random() * 10000))::int::text, 4, '0'), true, false)
  on conflict (restaurant_id) do nothing;
  return v_rid;
end;
$$;

create or replace function public.ensure_kiosk_table(p_restaurant uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from public.dining_tables
  where restaurant_id = p_restaurant and channel_type = 'kiosko' and active = true limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.dining_tables (restaurant_id, number, seats, channel_type, state, active)
  values (p_restaurant, 99, 1, 'kiosko', 'libre', true) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ensure_channel_tables(p_restaurant uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_member(p_restaurant) then
    raise exception 'sin permiso';
  end if;
  if not exists (select 1 from public.dining_tables where restaurant_id = p_restaurant and channel_type = 'caja') then
    update public.dining_tables set channel_type = 'caja'
    where restaurant_id = p_restaurant and number = 1 and channel_type <> 'caja';
    if not found then
      insert into public.dining_tables (restaurant_id, number, seats, state, active, channel_type)
      values (p_restaurant, 1, 1, 'libre', true, 'caja');
    end if;
  end if;
  if not exists (select 1 from public.dining_tables where restaurant_id = p_restaurant and channel_type = 'kiosko') then
    insert into public.dining_tables (restaurant_id, number, seats, state, active, channel_type)
    select p_restaurant, coalesce((select max(number) from public.dining_tables where restaurant_id = p_restaurant), 0) + 1,
           1, 'libre', true, 'kiosko';
  end if;
end;
$$;

alter function public.ensure_order_public_code() set search_path = public;
alter function public.order_items_default_status() set search_path = public;

-- Estas RPC ya están en producción. Se recrean para que una base nueva (CI) también las tenga.
create or replace function public.waiter_login(p_restaurant uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_w public.waiters%rowtype;
  v_tables uuid[];
begin
  select * into v_w from public.waiters
  where restaurant_id = p_restaurant and access_code = p_code and active = true limit 1;
  if not found then raise exception 'código inválido'; end if;
  select coalesce(array_agg(table_id), '{}') into v_tables from public.waiter_tables where waiter_id = v_w.id;
  return jsonb_build_object('id', v_w.id, 'name', v_w.name, 'restaurant_id', v_w.restaurant_id, 'table_ids', to_jsonb(v_tables));
end;
$$;

create or replace function public.cancel_order(p_order uuid, p_reason text default 'cancelada por el local')
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_table uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, table_id, status::text into v_rid, v_table, v_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'la orden ya está cerrada'; end if;
  update public.orders
    set status = 'cancelada'::public.order_status,
        cancel_reason = coalesce(nullif(trim(p_reason), ''), 'cancelada por el local'),
        closed_at = now()
  where id = p_order;
  if v_table is not null and not exists (
    select 1 from public.orders o where o.table_id = v_table and o.id <> p_order and o.status::text not in ('pagada', 'cancelada')
  ) and (select state::text from public.dining_tables where id = v_table) is distinct from 'no_disponible' then
    update public.dining_tables set state = 'libre'::public.table_state where id = v_table;
  end if;
end;
$$;

create or replace function public.confirm_web_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_table uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, table_id into v_rid, v_table from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  update public.orders set status = 'cocina'::public.order_status, needs_confirmation = false
  where id = p_order and status::text = 'pendiente';
  if v_table is not null then
    update public.dining_tables set state = 'ocupada'::public.table_state where id = v_table;
  end if;
end;
$$;

create or replace function public.recompute_order_status(p_order uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text; v_pend int; v_prep int; v_act int;
begin
  select status::text into v_status from public.orders where id = p_order;
  if v_status is null then return null; end if;
  if v_status in ('pagada', 'cancelada', 'pendiente') then return v_status; end if;
  select
    count(*) filter (where coalesce(status, 'pendiente') = 'pendiente'),
    count(*) filter (where coalesce(status, 'pendiente') = 'preparado'),
    count(*) filter (where coalesce(status, 'pendiente') <> 'cancelado')
  into v_pend, v_prep, v_act
  from public.order_items where order_id = p_order;
  if v_act = 0 then return v_status; end if;
  if v_pend = 0 and v_prep > 0 then
    update public.orders set status = 'lista'::public.order_status where id = p_order;
    return 'lista';
  end if;
  if v_status in ('lista', 'entregada', 'cocina', 'abierta') then
    update public.orders set status = 'cocina'::public.order_status
    where id = p_order and status::text not in ('pagada', 'cancelada', 'pendiente');
    return 'cocina';
  end if;
  return v_status;
end;
$$;

create or replace function public.set_order_item_status(p_order uuid, p_product uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_ord_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_status not in ('pendiente', 'preparado', 'cancelado') then raise exception 'status de ítem inválido'; end if;
  select restaurant_id, status::text into v_rid, v_ord_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_ord_status in ('pagada', 'cancelada') then raise exception 'la orden ya está cerrada'; end if;
  update public.order_items set status = p_status where order_id = p_order and product_id = p_product;
  if not found then raise exception 'ítem no existe en la orden'; end if;
  return public.recompute_order_status(p_order);
end;
$$;

create or replace function public.mark_order_items_preparado(p_order uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_ord_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, status::text into v_rid, v_ord_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_ord_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;
  update public.order_items set status = 'preparado' where order_id = p_order and status <> 'cancelado';
  return public.recompute_order_status(p_order);
end;
$$;

create or replace function public.send_order_to_kitchen(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, status::text into v_rid, v_status from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;
  update public.order_items set status = 'pendiente'
  where order_id = p_order and coalesce(status, 'pendiente') <> 'cancelado';
  update public.orders set status = 'cocina'::public.order_status where id = p_order;
end;
$$;

create or replace function public.set_order_status(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_status not in ('pendiente', 'cocina', 'lista', 'entregada', 'abierta') then raise exception 'estado inválido'; end if;
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  update public.orders set status = p_status::public.order_status
  where id = p_order and status::text not in ('pagada', 'cancelada');
end;
$$;

create or replace function public.set_table_state(p_table uuid, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_state not in ('libre', 'ocupada', 'no_disponible') then raise exception 'estado de mesa inválido'; end if;
  select restaurant_id into v_rid from public.dining_tables where id = p_table;
  if v_rid is null then raise exception 'mesa no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if p_state in ('libre', 'no_disponible') and exists (
    select 1 from public.orders o where o.table_id = p_table and o.status::text not in ('pagada', 'cancelada')
  ) then
    raise exception 'hay una orden activa en la mesa';
  end if;
  update public.dining_tables set state = p_state::public.table_state where id = p_table;
end;
$$;

create or replace function public.set_order_discount(p_order uuid, p_type text, p_value numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_sub numeric; v_amt numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_type is not null and p_type not in ('porcentaje', 'monto') then raise exception 'tipo descuento inválido'; end if;
  select restaurant_id into v_rid from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  v_sub := public.order_subtotal(p_order);
  if p_type is null or coalesce(p_value, 0) <= 0 then
    update public.orders set discount_type = null, discount_value = 0, discount_amount = 0 where id = p_order;
    return;
  end if;
  if p_type = 'porcentaje' then v_amt := round(v_sub * p_value / 100.0, 2); else v_amt := least(v_sub, p_value); end if;
  update public.orders set discount_type = p_type, discount_value = p_value, discount_amount = v_amt where id = p_order;
end;
$$;

create or replace function public.ensure_unit_product_inventory(
  p_product uuid, p_stock numeric default 0, p_min_stock numeric default 0, p_unit text default 'pza'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_name text; v_ing uuid; v_unit text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, name into v_rid, v_name from public.products where id = p_product;
  if v_rid is null then raise exception 'producto no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  v_unit := coalesce(nullif(trim(p_unit), ''), 'pza');
  select rl.ingredient_id into v_ing from public.recipe_lines rl where rl.product_id = p_product limit 1;
  if v_ing is null then
    select i.id into v_ing from public.ingredients i where i.restaurant_id = v_rid and lower(i.name) = lower(v_name) limit 1;
  end if;
  if v_ing is null then
    insert into public.ingredients (restaurant_id, name, unit, stock, min_stock, kind, is_extra)
    values (v_rid, v_name, v_unit, coalesce(p_stock, 0), coalesce(p_min_stock, 0), 'no_perecedero', false)
    returning id into v_ing;
  else
    update public.ingredients set stock = coalesce(p_stock, stock), min_stock = coalesce(p_min_stock, min_stock), unit = v_unit, is_extra = false where id = v_ing;
  end if;
  insert into public.recipe_lines (product_id, ingredient_id, qty) values (p_product, v_ing, 1)
  on conflict (product_id, ingredient_id) do update set qty = 1;
  delete from public.recipe_lines where product_id = p_product and ingredient_id <> v_ing;
  update public.products set inventory_mode = 'unitario' where id = p_product;
  return v_ing;
end;
$$;

-- Quita EXECUTE amplio y lo devuelve solo donde el cliente lo necesita.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function public.is_member(uuid) to anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role[]) to anon, authenticated;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.waiter_login(uuid, text) to anon, authenticated;
grant execute on function public.set_order_waiter(uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_public_ticket(uuid) to anon, authenticated;
grant execute on function public.can_operate(uuid) to anon, authenticated;
grant execute on function public.ensure_order_public_code() to anon, authenticated;
grant execute on function public.order_items_default_status() to anon, authenticated;

grant execute on function public.create_my_restaurant(text) to authenticated;
grant execute on function public.close_order(uuid, text) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.confirm_web_order(uuid) to authenticated;
grant execute on function public.ensure_channel_tables(uuid) to authenticated;
grant execute on function public.ensure_kiosk_table(uuid) to authenticated;
grant execute on function public.ensure_unit_product_inventory(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.mark_order_items_preparado(uuid) to authenticated;
grant execute on function public.register_entrada(uuid, numeric, text) to authenticated;
grant execute on function public.register_merma(uuid, numeric, text) to authenticated;
grant execute on function public.send_order_to_kitchen(uuid) to authenticated;
grant execute on function public.set_order_discount(uuid, text, numeric) to authenticated;
grant execute on function public.set_order_item_status(uuid, uuid, text) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
grant execute on function public.set_table_state(uuid, text) to authenticated;
grant execute on function public.recompute_order_status(uuid) to authenticated;
grant execute on function public.order_subtotal(uuid) to authenticated;

grant execute on function public.activate_plan(uuid, text, text, text, text) to service_role;

-- Listas de productos (custom-list del API) y comentarios de orden.
create table if not exists public.product_lists (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.product_list_items (
  list_id uuid not null references public.product_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (list_id, product_id)
);
create index if not exists product_lists_restaurant_id_idx on public.product_lists (restaurant_id);
create index if not exists product_list_items_product_id_idx on public.product_list_items (product_id);

create table if not exists public.order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  body text not null,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists order_comments_order_id_idx on public.order_comments (order_id);

alter table public.product_lists enable row level security;
alter table public.product_list_items enable row level security;
alter table public.order_comments enable row level security;

drop policy if exists product_lists_member on public.product_lists;
create policy product_lists_member on public.product_lists
  for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

drop policy if exists product_list_items_member on public.product_list_items;
create policy product_list_items_member on public.product_list_items
  for all to authenticated
  using (exists (
    select 1 from public.product_lists l
    where l.id = list_id and public.is_member(l.restaurant_id)
  ))
  with check (exists (
    select 1 from public.product_lists l
    where l.id = list_id and public.is_member(l.restaurant_id)
  ));

drop policy if exists order_comments_member on public.order_comments;
create policy order_comments_member on public.order_comments
  for all to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and public.is_member(o.restaurant_id)
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id and public.is_member(o.restaurant_id)
  ));

grant select, insert, update, delete on public.product_lists to authenticated;
grant select, insert, update, delete on public.product_list_items to authenticated;
grant select, insert, update, delete on public.order_comments to authenticated;
