-- Paridad operativa: turno de caja, propina y cambio, clientes, áreas,
-- invitaciones de equipo, tope de plan y devolución de inventario.
-- Aditiva e idempotente. No borra filas ni reescribe totales históricos.
--
-- Reglas de dinero (explícitas, para no improvisar el cobro):
-- * El precio de la carta ya es lo que se cobra. No se calcula ni se desglosa IVA.
-- * El descuento de línea se resta primero. El descuento de la orden se aplica
--   después, sobre ese subtotal, igual que ApiWapifood /orders.
-- * La propina no forma parte del precio del platillo. Es un monto capturado
--   aparte (default 0). No hay porcentaje automático.
-- * A cobrar = alimentos después de descuentos + propina.
-- * Cambio = efectivo recibido − a cobrar. Se guarda en centavos (round half away, 2 decimales).
-- * El cajón solo suma alimentos y propina pagados en efectivo. Tarjeta y
--   transferencia no entran al efectivo esperado.
-- * Vender sin turno abierto se permite: el legado no tenía corte. El movimiento
--   de cajón solo se escribe si hay un turno abierto.
-- * Devolver un platillo ya cobrado mueve inventario. No modifica el dinero cobrado.

alter table public.orders
  add column if not exists cash_tendered numeric(12,2),
  add column if not exists change_amount numeric(12,2),
  add column if not exists tip_amount numeric(12,2) not null default 0,
  add column if not exists charged_food numeric(12,2);

alter table public.order_items
  add column if not exists stock_resolution text;

do $$ begin
  alter table public.order_items
    add constraint order_items_stock_resolution_check
    check (stock_resolution is null or stock_resolution in ('devuelto', 'merma'));
exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.dining_areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  sort_order integer not null default 0,
  unique (restaurant_id, name)
);

alter table public.dining_tables
  add column if not exists area_id uuid references public.dining_areas(id) on delete set null;

create index if not exists dining_tables_area_id_idx on public.dining_tables (area_id);
create index if not exists dining_areas_restaurant_id_idx on public.dining_areas (restaurant_id);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text,
  phone text,
  address text,
  notes text,
  visits integer not null default 1 check (visits >= 0),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.customers
    add constraint customers_restaurant_phone_key unique (restaurant_id, phone);
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists customers_restaurant_id_idx on public.customers (restaurant_id);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  opened_by uuid,
  opened_at timestamptz not null default now(),
  opening_float numeric(12,2) not null default 0 check (opening_float >= 0),
  closed_by uuid,
  closed_at timestamptz,
  counted_cash numeric(12,2),
  expected_cash numeric(12,2),
  difference numeric(12,2),
  notes text,
  status text not null default 'open' check (status in ('open', 'closed'))
);

create unique index if not exists cash_sessions_one_open
  on public.cash_sessions (restaurant_id)
  where status = 'open';

create index if not exists cash_sessions_restaurant_id_idx on public.cash_sessions (restaurant_id);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  kind text not null check (kind in ('venta_efectivo', 'propina_efectivo', 'entrada', 'salida')),
  amount numeric(12,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_session_id_idx on public.cash_movements (session_id);
create index if not exists cash_movements_order_id_idx on public.cash_movements (order_id);
create index if not exists cash_movements_restaurant_id_idx on public.cash_movements (restaurant_id);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  invited_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (restaurant_id, email),
  check ((role::text) <> 'owner')
);

create index if not exists team_invites_restaurant_id_idx on public.team_invites (restaurant_id);

alter table public.dining_areas enable row level security;
alter table public.customers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.team_invites enable row level security;

drop policy if exists dining_areas_member on public.dining_areas;
create policy dining_areas_member on public.dining_areas
  for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

drop policy if exists customers_member on public.customers;
create policy customers_member on public.customers
  for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

drop policy if exists cash_sessions_member on public.cash_sessions;
create policy cash_sessions_member on public.cash_sessions
  for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

drop policy if exists cash_movements_member on public.cash_movements;
create policy cash_movements_member on public.cash_movements
  for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

drop policy if exists team_invites_read on public.team_invites;
create policy team_invites_read on public.team_invites
  for select to authenticated
  using (public.is_member(restaurant_id));

drop policy if exists team_invites_write on public.team_invites;
create policy team_invites_write on public.team_invites
  for all to authenticated
  using (public.has_role(restaurant_id, array['owner', 'admin']::public.app_role[]))
  with check (
    public.has_role(restaurant_id, array['owner', 'admin']::public.app_role[])
    and role in ('admin', 'piso', 'cocina')
  );

grant select, insert, update, delete on public.dining_areas to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.cash_sessions to authenticated;
grant select, insert, update, delete on public.cash_movements to authenticated;
grant select, insert, update, delete on public.team_invites to authenticated;

-- ---------- dinero de la orden ----------
create or replace function public.order_food_total(p_order uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(greatest(0,
    public.order_subtotal(p_order) - coalesce((
      select discount_amount from public.orders where id = p_order
    ), 0)
  ), 2);
$$;

create or replace function public.set_item_discount(
  p_order uuid,
  p_product uuid,
  p_type text,
  p_value numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
  v_sub numeric;
  v_amt numeric;
  v_order_type text;
  v_order_value numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_type is not null and p_type not in ('porcentaje', 'monto') then
    raise exception 'tipo descuento inválido';
  end if;
  select restaurant_id, status::text, discount_type, coalesce(discount_value, 0)
    into v_rid, v_status, v_order_type, v_order_value
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status in ('pagada', 'cancelada') then raise exception 'orden cerrada'; end if;
  if p_type = 'porcentaje' and (p_value < 0 or p_value > 100) then
    raise exception 'el porcentaje debe estar entre 0 y 100';
  end if;
  if p_type = 'monto' and coalesce(p_value, 0) < 0 then
    raise exception 'el descuento no puede ser negativo';
  end if;

  if p_type is null or coalesce(p_value, 0) <= 0 then
    update public.order_items
      set discount_type = null, discount_value = 0
    where order_id = p_order and product_id = p_product;
  else
    update public.order_items
      set discount_type = p_type, discount_value = round(p_value, 2)
    where order_id = p_order and product_id = p_product;
  end if;
  if not found then raise exception 'ítem no existe en la orden'; end if;

  v_sub := public.order_subtotal(p_order);
  if v_order_type is null or v_order_value <= 0 then
    update public.orders set discount_amount = 0 where id = p_order;
  elsif v_order_type = 'porcentaje' then
    v_amt := round(v_sub * v_order_value / 100.0, 2);
    update public.orders set discount_amount = least(v_sub, v_amt) where id = p_order;
  else
    update public.orders set discount_amount = least(v_sub, v_order_value) where id = p_order;
  end if;
end;
$$;

create or replace function public.close_order(
  p_order uuid,
  p_method text default 'efectivo',
  p_cash numeric default null,
  p_tip numeric default 0
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
  v_method text;
  v_food numeric;
  v_tip numeric;
  v_due numeric;
  v_cash numeric;
  v_change numeric;
  v_session uuid;
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

  v_tip := round(greatest(0, coalesce(p_tip, 0)), 2);
  v_food := public.order_food_total(p_order);
  v_due := round(v_food + v_tip, 2);
  v_cash := case when p_cash is null then null else round(p_cash, 2) end;
  if v_method = 'efectivo' and v_cash is not null and v_cash + 0.001 < v_due then
    raise exception 'el efectivo recibido no alcanza el total';
  end if;
  v_change := case
    when v_method = 'efectivo' and v_cash is not null then round(greatest(0, v_cash - v_due), 2)
    else null
  end;

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
        stock_applied = true,
        tip_amount = v_tip,
        charged_food = v_food,
        cash_tendered = case when v_method = 'efectivo' then v_cash else null end,
        change_amount = v_change
  where id = p_order;

  select id into v_session
  from public.cash_sessions
  where restaurant_id = v_rid and status = 'open'
  limit 1;

  if v_session is not null and v_method = 'efectivo' then
    if v_food > 0 then
      insert into public.cash_movements (session_id, restaurant_id, order_id, kind, amount, note)
      values (v_session, v_rid, p_order, 'venta_efectivo', v_food, 'venta');
    end if;
    if v_tip > 0 then
      insert into public.cash_movements (session_id, restaurant_id, order_id, kind, amount, note)
      values (v_session, v_rid, p_order, 'propina_efectivo', v_tip, 'propina');
    end if;
  end if;

  if v_table is not null and not exists (
    select 1 from public.orders o
    where o.table_id = v_table and o.id <> p_order
      and o.status::text not in ('pagada', 'cancelada')
  ) and (select state::text from public.dining_tables where id = v_table) is distinct from 'no_disponible' then
    update public.dining_tables set state = 'libre'::public.table_state where id = v_table;
  end if;
end;
$$;

drop function if exists public.close_order(uuid, text);

create or replace function public.return_sold_stock(
  p_order uuid,
  p_product uuid,
  p_as_merma boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_applied boolean;
  v_status text;
  v_item_status text;
  v_resolution text;
  v_qty integer;
  r record;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, coalesce(stock_applied, false), status::text
    into v_rid, v_applied, v_status
  from public.orders where id = p_order;
  if v_rid is null then raise exception 'orden no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  select status, stock_resolution, qty
    into v_item_status, v_resolution, v_qty
  from public.order_items
  where order_id = p_order and product_id = p_product;
  if not found then raise exception 'ítem no existe en la orden'; end if;
  if v_resolution is not null then raise exception 'el inventario de este platillo ya se resolvió'; end if;

  if v_applied and v_status = 'pagada' and coalesce(v_item_status, 'pendiente') <> 'cancelado' then
    for r in
      select rl.ingredient_id, (rl.qty * v_qty) as need
      from public.recipe_lines rl
      join public.products p on p.id = rl.product_id
      where rl.product_id = p_product
        and coalesce(p.inventory_mode, 'unitario') <> 'none'
      union all
      select x.ingredient_id, (x.qty * v_qty) as need
      from public.order_item_extras x
      where x.order_id = p_order and x.product_id = p_product
    loop
      if coalesce(p_as_merma, false) then
        insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
        values (v_rid, r.ingredient_id, p_order, 0, 'merma', 'platillo cobrado, se queda como merma');
      else
        update public.ingredients
          set stock = stock + r.need
        where id = r.ingredient_id and restaurant_id = v_rid;
        insert into public.stock_moves (restaurant_id, ingredient_id, order_id, qty, reason, note)
        values (v_rid, r.ingredient_id, p_order, r.need, 'ajuste', 'devolución de platillo cobrado');
      end if;
    end loop;
    update public.order_items
      set status = 'cancelado',
          stock_resolution = case when coalesce(p_as_merma, false) then 'merma' else 'devuelto' end
    where order_id = p_order and product_id = p_product;
  else
    update public.order_items
      set status = 'cancelado'
    where order_id = p_order and product_id = p_product;
    perform public.recompute_order_status(p_order);
  end if;
end;
$$;

-- ---------- turno ----------
create or replace function public.open_cash_session(p_restaurant uuid, p_float numeric default 0)
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
  if coalesce(p_float, 0) < 0 then raise exception 'el fondo no puede ser negativo'; end if;
  if exists (
    select 1 from public.cash_sessions
    where restaurant_id = p_restaurant and status = 'open'
  ) then
    raise exception 'ya hay un turno abierto';
  end if;
  insert into public.cash_sessions (restaurant_id, opened_by, opening_float, status)
  values (p_restaurant, auth.uid(), round(coalesce(p_float, 0), 2), 'open')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.add_cash_movement(
  p_session uuid,
  p_kind text,
  p_amount numeric,
  p_note text default null
)
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
  if p_kind not in ('entrada', 'salida') then raise exception 'solo entrada o salida manual'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'cantidad inválida'; end if;
  select restaurant_id, status into v_rid, v_status from public.cash_sessions where id = p_session;
  if v_rid is null then raise exception 'turno no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  if v_status <> 'open' then raise exception 'el turno ya está cerrado'; end if;
  insert into public.cash_movements (session_id, restaurant_id, kind, amount, note)
  values (p_session, v_rid, p_kind, round(p_amount, 2), nullif(trim(p_note), ''));
end;
$$;

create or replace function public.cash_expected(p_session uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(
    coalesce((select opening_float from public.cash_sessions where id = p_session), 0)
    + coalesce((
      select sum(case when kind = 'salida' then -amount else amount end)
      from public.cash_movements where session_id = p_session
    ), 0)
  , 2);
$$;

create or replace function public.close_cash_session(
  p_session uuid,
  p_counted numeric,
  p_notes text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_status text;
  v_expected numeric;
  v_diff numeric;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'el conteo no puede ser negativo'; end if;
  select restaurant_id, status into v_rid, v_status from public.cash_sessions where id = p_session;
  if v_rid is null then raise exception 'turno no existe'; end if;
  if not public.has_role(v_rid, array['owner', 'admin', 'piso']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if v_status <> 'open' then raise exception 'el turno ya está cerrado'; end if;
  v_expected := public.cash_expected(p_session);
  v_diff := round(round(p_counted, 2) - v_expected, 2);
  update public.cash_sessions
    set status = 'closed',
        closed_at = now(),
        closed_by = auth.uid(),
        counted_cash = round(p_counted, 2),
        expected_cash = v_expected,
        difference = v_diff,
        notes = nullif(trim(p_notes), '')
  where id = p_session;
  return v_diff;
end;
$$;

-- ---------- clientes ----------
create or replace function public.remember_order_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := nullif(trim(new.customer_phone), '');
begin
  if v_phone is null then
    return new;
  end if;
  insert into public.customers (restaurant_id, name, phone, address, visits, last_seen)
  values (
    new.restaurant_id,
    nullif(trim(new.customer_name), ''),
    v_phone,
    nullif(trim(new.delivery_address), ''),
    1,
    coalesce(new.opened_at, now())
  )
  on conflict (restaurant_id, phone)
  do update set
    name = coalesce(excluded.name, public.customers.name),
    address = coalesce(excluded.address, public.customers.address),
    visits = public.customers.visits + 1,
    last_seen = excluded.last_seen;
  return new;
end;
$$;

drop trigger if exists trg_remember_order_customer on public.orders;
create trigger trg_remember_order_customer
  after insert on public.orders
  for each row execute function public.remember_order_customer();

-- ---------- equipo ----------
create or replace function public.list_team(p_restaurant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  select jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'email', u.email,
        'created_at', m.created_at
      ) order by m.created_at)
      from public.memberships m
      join auth.users u on u.id = m.user_id
      where m.restaurant_id = p_restaurant
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'role', i.role,
        'created_at', i.created_at,
        'accepted_at', i.accepted_at
      ) order by i.created_at desc)
      from public.team_invites i
      where i.restaurant_id = p_restaurant and i.accepted_at is null
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.invite_team_member(p_restaurant uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.has_role(p_restaurant, array['owner', 'admin']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if v_email is null or position('@' in v_email) = 0 then raise exception 'correo inválido'; end if;
  if p_role not in ('admin', 'piso', 'cocina') then raise exception 'rol inválido'; end if;
  insert into public.team_invites (restaurant_id, email, role, invited_by)
  values (p_restaurant, v_email, p_role::public.app_role, auth.uid())
  on conflict (restaurant_id, email) do update
    set role = excluded.role,
        invited_by = excluded.invited_by,
        accepted_at = null,
        created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.accept_team_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_count integer := 0;
  inv record;
begin
  if v_uid is null then return 0; end if;
  if v_email = '' then return 0; end if;
  for inv in
    select * from public.team_invites
    where lower(email) = v_email and accepted_at is null
  loop
    if exists (
      select 1 from public.memberships
      where user_id = v_uid and restaurant_id <> inv.restaurant_id
    ) then
      continue;
    end if;
    insert into public.memberships (restaurant_id, user_id, role)
    values (inv.restaurant_id, v_uid, inv.role)
    on conflict (restaurant_id, user_id) do nothing;
    update public.team_invites set accepted_at = now() where id = inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.set_member_role(p_restaurant uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owners integer;
  v_current public.app_role;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.has_role(p_restaurant, array['owner', 'admin']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  if p_role not in ('admin', 'piso', 'cocina', 'owner') then raise exception 'rol inválido'; end if;
  if p_role = 'owner' and not public.has_role(p_restaurant, array['owner']::public.app_role[]) then
    raise exception 'solo el dueño puede nombrar otro dueño';
  end if;
  select role into v_current from public.memberships
  where restaurant_id = p_restaurant and user_id = p_user;
  if v_current is null then raise exception 'no es miembro'; end if;
  if v_current = 'owner' and not public.has_role(p_restaurant, array['owner']::public.app_role[]) then
    raise exception 'solo el dueño puede cambiar a otro dueño';
  end if;
  if v_current = 'owner' and p_role <> 'owner' then
    select count(*) into v_owners from public.memberships
    where restaurant_id = p_restaurant and role = 'owner';
    if v_owners <= 1 then raise exception 'tiene que quedar un dueño'; end if;
  end if;
  update public.memberships
    set role = p_role::public.app_role
  where restaurant_id = p_restaurant and user_id = p_user;
end;
$$;

create or replace function public.remove_member(p_restaurant uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_owners integer;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.has_role(p_restaurant, array['owner', 'admin']::public.app_role[]) then
    raise exception 'sin permiso';
  end if;
  select role into v_role from public.memberships
  where restaurant_id = p_restaurant and user_id = p_user;
  if v_role is null then raise exception 'no es miembro'; end if;
  if v_role = 'owner' then
    if not public.has_role(p_restaurant, array['owner']::public.app_role[]) then
      raise exception 'solo el dueño puede quitar a otro dueño';
    end if;
    select count(*) into v_owners from public.memberships
    where restaurant_id = p_restaurant and role = 'owner';
    if v_owners <= 1 then raise exception 'tiene que quedar un dueño'; end if;
  end if;
  delete from public.memberships
  where restaurant_id = p_restaurant and user_id = p_user;
end;
$$;

-- ---------- topes del plan (los mismos números que src/lib/plans.js) ----------
create or replace function public.restaurant_caps(p_restaurant uuid)
returns table (max_mesas integer, max_meseros integer, plan text)
language sql
stable
security definer
set search_path = public
as $$
  select
    case coalesce(s.plan, 'ventas') when 'restaurante' then 15 when 'plus' then 25 else 3 end,
    case coalesce(s.plan, 'ventas') when 'restaurante' then 5 when 'plus' then 10 else 2 end,
    coalesce(s.plan, 'ventas')
  from public.subscriptions s
  where s.restaurant_id = p_restaurant
    and s.status in ('active', 'trialing')
    and (s.ends_at is null or s.ends_at > now())
  order by s.created_at desc
  limit 1;
$$;

create or replace function public.enforce_plan_caps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesas integer;
  v_meseros integer;
  v_used integer;
begin
  if tg_table_name = 'waiters' then
    if tg_op = 'UPDATE' and new.active is not true then
      return new;
    end if;
    if tg_op = 'INSERT' and new.active is not true then
      return new;
    end if;
    select max_meseros into v_meseros from public.restaurant_caps(new.restaurant_id);
    if v_meseros is null then
      raise exception 'no hay un plan vigente para dar de alta meseros';
    end if;
    select count(*) into v_used from public.waiters
    where restaurant_id = new.restaurant_id and active is true and id is distinct from new.id;
    if v_used >= v_meseros then
      raise exception 'tope de meseros del plan (%)', v_meseros;
    end if;
    return new;
  end if;

  if new.channel_type not in ('piso', 'tablet') or new.active is not true then
    return new;
  end if;
  select max_mesas into v_mesas from public.restaurant_caps(new.restaurant_id);
  if v_mesas is null then
    raise exception 'no hay un plan vigente para dar de alta mesas';
  end if;
  select count(*) into v_used from public.dining_tables
  where restaurant_id = new.restaurant_id
    and active is true
    and channel_type in ('piso', 'tablet')
    and id is distinct from new.id;
  if v_used >= v_mesas then
    raise exception 'tope de mesas del plan (%)', v_mesas;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_waiter_plan_cap on public.waiters;
create trigger trg_waiter_plan_cap
  before insert or update of active on public.waiters
  for each row execute function public.enforce_plan_caps();

drop trigger if exists trg_table_plan_cap on public.dining_tables;
create trigger trg_table_plan_cap
  before insert or update of active, channel_type on public.dining_tables
  for each row execute function public.enforce_plan_caps();

-- ---------- reportes ----------
create or replace function public.sales_report(p_restaurant uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'rango inválido'; end if;

  with paid as (
    select o.*
    from public.orders o
    where o.restaurant_id = p_restaurant
      and o.status = 'pagada'
      and (coalesce(o.closed_at, o.opened_at) at time zone 'America/Mexico_City')::date
          between p_from and p_to
  ),
  lines as (
    select oi.order_id, oi.product_id, oi.qty, oi.unit_price, oi.status, p.name, p.cost
    from public.order_items oi
    join paid o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where coalesce(oi.status, 'pendiente') <> 'cancelado'
       or oi.stock_resolution is not null
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'tickets', (select count(*) from paid),
    'food', coalesce((select round(sum(coalesce(charged_food, public.order_food_total(id))), 2) from paid), 0),
    'tips', coalesce((select round(sum(coalesce(tip_amount, 0)), 2) from paid), 0),
    'discounts', coalesce((select round(sum(coalesce(discount_amount, 0)), 2) from paid), 0),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object(
        'method', method,
        'tickets', tickets,
        'food', food,
        'tips', tips
      ) order by method)
      from (
        select coalesce(payment_method, method::text, 'sin_metodo') as method,
               count(*) as tickets,
               round(sum(coalesce(charged_food, public.order_food_total(id))), 2) as food,
               round(sum(coalesce(tip_amount, 0)), 2) as tips
        from paid
        group by 1
      ) m
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'food', food) order by food desc)
      from (
        select name, sum(qty) as qty, round(sum(unit_price * qty), 2) as food
        from lines
        group by name
        order by sum(unit_price * qty) desc
        limit 8
      ) t
    ), '[]'::jsonb),
    'by_waiter', coalesce((
      select jsonb_agg(jsonb_build_object(
        'waiter', waiter, 'tickets', tickets, 'food', food
      ) order by food desc)
      from (
        select coalesce(w.name, 'Sin mesero') as waiter,
               count(*) as tickets,
               round(sum(coalesce(o.charged_food, public.order_food_total(o.id))), 2) as food
        from paid o
        left join public.waiters w on w.id = o.waiter_id
        group by 1
      ) w
    ), '[]'::jsonb),
    'margin_estimate', coalesce((
      select round(sum((l.unit_price - coalesce(l.cost, 0)) * l.qty), 2) from lines l
    ), 0)
  ) into v;
  return v;
end;
$$;

revoke all on function public.order_food_total(uuid) from public, anon, authenticated;
revoke all on function public.set_item_discount(uuid, uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.close_order(uuid, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.return_sold_stock(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.open_cash_session(uuid, numeric) from public, anon, authenticated;
revoke all on function public.add_cash_movement(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.cash_expected(uuid) from public, anon, authenticated;
revoke all on function public.close_cash_session(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.remember_order_customer() from public, anon, authenticated;
revoke all on function public.list_team(uuid) from public, anon, authenticated;
revoke all on function public.invite_team_member(uuid, text, text) from public, anon, authenticated;
revoke all on function public.accept_team_invites() from public, anon, authenticated;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.restaurant_caps(uuid) from public, anon, authenticated;
revoke all on function public.enforce_plan_caps() from public, anon, authenticated;
revoke all on function public.sales_report(uuid, date, date) from public, anon, authenticated;

grant execute on function public.set_item_discount(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.close_order(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.return_sold_stock(uuid, uuid, boolean) to authenticated;
grant execute on function public.open_cash_session(uuid, numeric) to authenticated;
grant execute on function public.add_cash_movement(uuid, text, numeric, text) to authenticated;
grant execute on function public.cash_expected(uuid) to authenticated;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.list_team(uuid) to authenticated;
grant execute on function public.invite_team_member(uuid, text, text) to authenticated;
grant execute on function public.accept_team_invites() to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.restaurant_caps(uuid) to authenticated;
grant execute on function public.sales_report(uuid, date, date) to authenticated;
