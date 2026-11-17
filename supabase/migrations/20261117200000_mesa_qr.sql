-- Pedir desde el celular. El QR impreso no cambia. La sesión sí.

alter table public.restaurants add column if not exists slug text;

update public.restaurants r
set slug = left(trim(both '-' from lower(regexp_replace(r.name, '[^a-zA-Z0-9]+', '-', 'g'))), 40) || '-' || left(r.id::text, 8)
where r.slug is null or r.slug = '';

create unique index if not exists restaurants_slug_key on public.restaurants (slug);

alter table public.restaurant_profiles
  add column if not exists qr_auto_open boolean not null default false,
  add column if not exists qr_auto_accept boolean not null default false;

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.dining_tables (id) on delete cascade,
  token text not null unique,
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  order_id uuid references public.orders (id) on delete set null
);

create unique index if not exists table_sessions_one_open
  on public.table_sessions (table_id)
  where status = 'abierta';

create table if not exists public.table_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.table_sessions (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.dining_tables (id) on delete cascade,
  kind text not null check (kind in ('pedido', 'cuenta', 'mesero')),
  items jsonb,
  status text not null default 'pendiente' check (status in ('pendiente', 'aceptado', 'rechazado')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.table_sessions enable row level security;
alter table public.table_requests enable row level security;

drop policy if exists table_sessions_member on public.table_sessions;
create policy table_sessions_member on public.table_sessions
  for select to authenticated
  using (public.is_member(restaurant_id));

drop policy if exists table_requests_member on public.table_requests;
create policy table_requests_member on public.table_requests
  for select to authenticated
  using (public.is_member(restaurant_id));

revoke all on public.table_sessions from anon, authenticated;
revoke all on public.table_requests from anon, authenticated;
grant select on public.table_sessions to authenticated;
grant select on public.table_requests to authenticated;

create or replace function public.open_table_session(p_table uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rid uuid;
  v_number int;
  v_slug text;
  v_order uuid;
  v_token text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select restaurant_id, number into v_rid, v_number from public.dining_tables where id = p_table and active is true;
  if v_rid is null then raise exception 'mesa no existe'; end if;
  if not public.is_member(v_rid) then raise exception 'sin permiso'; end if;
  select slug into v_slug from public.restaurants where id = v_rid;

  select id, token into v_id, v_token
  from public.table_sessions
  where table_id = p_table and status = 'abierta'
  limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'token', v_token, 'slug', v_slug, 'number', v_number, 'already', true);
  end if;

  select id into v_order
  from public.orders
  where table_id = p_table and status::text not in ('pagada', 'cancelada')
  order by opened_at desc
  limit 1;
  if v_order is null then
    insert into public.orders (restaurant_id, table_id, status, source)
    values (v_rid, p_table, 'abierta', 'mesa')
    returning id into v_order;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.table_sessions (restaurant_id, table_id, token, opened_by, order_id)
  values (v_rid, p_table, v_token, auth.uid(), v_order)
  returning id into v_id;

  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (v_rid, v_order, auth.uid(), 'mesa_qr', 'Mesa abierta para pedir desde el celular', jsonb_build_object('table_id', p_table, 'session_id', v_id));

  return jsonb_build_object('id', v_id, 'token', v_token, 'slug', v_slug, 'number', v_number, 'already', false);
end;
$$;

create or replace function public.close_open_table_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text in ('pagada', 'cancelada') and old.status::text is distinct from new.status::text then
    update public.table_sessions
      set status = 'cerrada', closed_at = now()
    where status = 'abierta'
      and (order_id = new.id or table_id = new.table_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_close_table_session on public.orders;
create trigger trg_close_table_session
  after update of status on public.orders
  for each row execute function public.close_open_table_sessions();

create or replace function public.get_table_gate(p_slug text, p_number int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_name text;
  v_table uuid;
  v_token text;
begin
  select id, name into v_rid, v_name from public.restaurants where slug = p_slug;
  if v_rid is null then return jsonb_build_object('ok', false, 'open', false); end if;
  select id into v_table
  from public.dining_tables
  where restaurant_id = v_rid and number = p_number and active is true and channel_type in ('piso', 'tablet')
  limit 1;
  if v_table is null then return jsonb_build_object('ok', false, 'open', false, 'name', v_name); end if;
  select token into v_token
  from public.table_sessions
  where table_id = v_table and status = 'abierta'
  order by opened_at desc
  limit 1;
  return jsonb_build_object(
    'ok', true,
    'open', v_token is not null,
    'name', v_name,
    'number', p_number,
    'token', v_token
  );
end;
$$;

create or replace function public._table_session(p_token text)
returns public.table_sessions
language sql
stable
security definer
set search_path = public
as $$
  select * from public.table_sessions
  where token = p_token and status = 'abierta' and length(p_token) >= 32
  limit 1;
$$;

create or replace function public.get_table_menu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
  v_name text;
  v_number int;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  select name into v_name from public.restaurants where id = v.restaurant_id;
  select number into v_number from public.dining_tables where id = v.table_id;
  return jsonb_build_object(
    'restaurant', v_name,
    'number', v_number,
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price, 'image_url', p.image_url, 'category', c.name
      ) order by c.name, p.name)
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.restaurant_id = v.restaurant_id and p.active is true
    ), '[]'::jsonb),
    'modifiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', l.product_id,
        'group', g.name,
        'min', g.min_select,
        'max', g.max_select,
        'required', g.required,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.extra_price)), '[]'::jsonb)
          from public.modifier_options o where o.group_id = g.id
        )
      ))
      from public.product_modifier_groups l
      join public.modifier_groups g on g.id = l.group_id
      where g.restaurant_id = v.restaurant_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_table_bill(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name, 'qty', oi.qty, 'price', oi.unit_price, 'status', oi.status, 'notes', oi.notes
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
    'total', coalesce((
      select round(sum(oi.qty * oi.unit_price), 2)
      from public.order_items oi
      where oi.order_id = v.order_id and coalesce(oi.status, 'pendiente') <> 'cancelado'
    ), 0)
  );
end;
$$;

create or replace function public.place_table_order(p_token text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
  v_count int;
  row jsonb;
  v_product uuid;
  v_qty int;
  v_price numeric;
  v_notes text;
  v_auto boolean;
  v_id uuid;
  v_clean jsonb := '[]'::jsonb;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'el pedido está vacío';
  end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'el pedido es demasiado grande'; end if;
  select count(*) into v_count from public.table_requests
  where session_id = v.id and created_at > now() - interval '1 minute';
  if v_count >= 6 then raise exception 'espera un momento antes de enviar otro pedido'; end if;

  for row in select * from jsonb_array_elements(p_items)
  loop
    v_product := nullif(row->>'product_id', '')::uuid;
    v_qty := least(20, greatest(1, coalesce((row->>'qty')::int, 1)));
    v_notes := left(coalesce(row->>'notes', ''), 140);
    select price into v_price from public.products
    where id = v_product and restaurant_id = v.restaurant_id and active is true;
    if v_price is null then raise exception 'ese platillo no es de esta mesa'; end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'qty', v_qty, 'price', v_price, 'notes', nullif(v_notes, ''), 'name', (select name from public.products where id = v_product)
    ));
  end loop;

  select coalesce(qr_auto_accept, false) into v_auto
  from public.restaurant_profiles where restaurant_id = v.restaurant_id;

  insert into public.table_requests (session_id, restaurant_id, table_id, kind, items, status)
  values (v.id, v.restaurant_id, v.table_id, 'pedido', v_clean, case when v_auto then 'aceptado' else 'pendiente' end)
  returning id into v_id;

  if v_auto then
    insert into public.order_items (order_id, product_id, qty, unit_price, status, notes)
    select v.order_id, (x->>'product_id')::uuid, (x->>'qty')::int, (x->>'price')::numeric, 'pendiente', x->>'notes'
    from jsonb_array_elements(v_clean) x;
  end if;

  insert into public.action_log (restaurant_id, order_id, action, summary, detail)
  values (v.restaurant_id, v.order_id, 'mesa_qr', 'Pedido desde el celular', jsonb_build_object('request_id', v_id, 'auto', v_auto));

  return jsonb_build_object('id', v_id, 'accepted', v_auto);
end;
$$;

create or replace function public.call_waiter(p_slug text, p_number int, p_token text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_table uuid;
  v_count int;
  v_session uuid;
begin
  if p_token is not null then
    select restaurant_id, table_id, id into v_rid, v_table, v_session from public._table_session(p_token);
  end if;
  if v_table is null then
    select r.id, t.id into v_rid, v_table
    from public.restaurants r
    join public.dining_tables t on t.restaurant_id = r.id
    where r.slug = p_slug and t.number = p_number and t.active is true
    limit 1;
  end if;
  if v_table is null then raise exception 'mesa no existe'; end if;
  select count(*) into v_count from public.table_requests
  where table_id = v_table and kind = 'mesero' and created_at > now() - interval '10 minutes';
  if v_count >= 3 then raise exception 'ya avisamos al mesero. Espera un poco.'; end if;
  insert into public.table_requests (session_id, restaurant_id, table_id, kind, status)
  values (v_session, v_rid, v_table, 'mesero', 'pendiente');
  insert into public.action_log (restaurant_id, action, summary, detail)
  values (v_rid, 'mesa_qr', 'El cliente llamó al mesero', jsonb_build_object('table_id', v_table));
end;
$$;

create or replace function public.ask_table_bill(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_sessions;
begin
  select * into v from public._table_session(p_token);
  if v.id is null then raise exception 'mesa cerrada'; end if;
  insert into public.table_requests (session_id, restaurant_id, table_id, kind)
  values (v.id, v.restaurant_id, v.table_id, 'cuenta');
  insert into public.action_log (restaurant_id, order_id, action, summary)
  values (v.restaurant_id, v.order_id, 'mesa_qr', 'El cliente pidió la cuenta');
end;
$$;

create or replace function public.review_table_request(p_id uuid, p_accept boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.table_requests;
  s public.table_sessions;
  x jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select * into v from public.table_requests where id = p_id and status = 'pendiente';
  if v.id is null then raise exception 'ese aviso ya se atendió'; end if;
  if not public.is_member(v.restaurant_id) then raise exception 'sin permiso'; end if;
  if not p_accept then
    update public.table_requests set status = 'rechazado', reason = left(coalesce(p_reason, 'No se pudo'), 140) where id = p_id;
    insert into public.action_log (restaurant_id, actor, action, summary, detail)
    values (v.restaurant_id, auth.uid(), 'mesa_qr', 'Pedido del celular rechazado', jsonb_build_object('request_id', p_id, 'reason', p_reason));
    return;
  end if;
  select * into s from public.table_sessions where id = v.session_id and status = 'abierta';
  if v.kind = 'pedido' then
    if s.id is null then raise exception 'la mesa ya se cerró'; end if;
    for x in select * from jsonb_array_elements(coalesce(v.items, '[]'::jsonb))
    loop
      insert into public.order_items (order_id, product_id, qty, unit_price, status, notes)
      values (s.order_id, (x->>'product_id')::uuid, (x->>'qty')::int, (x->>'price')::numeric, 'pendiente', x->>'notes');
    end loop;
  end if;
  update public.table_requests set status = 'aceptado' where id = p_id;
  insert into public.action_log (restaurant_id, order_id, actor, action, summary, detail)
  values (v.restaurant_id, s.order_id, auth.uid(), 'mesa_qr', 'Pedido del celular aceptado', jsonb_build_object('request_id', p_id));
end;
$$;

revoke all on function public.open_table_session(uuid) from public, anon;
revoke all on function public.close_open_table_sessions() from public, anon, authenticated;
revoke all on function public._table_session(text) from public, anon, authenticated;
grant execute on function public.open_table_session(uuid) to authenticated;
grant execute on function public.get_table_gate(text, int) to anon, authenticated;
grant execute on function public.get_table_menu(text) to anon, authenticated;
grant execute on function public.get_table_bill(text) to anon, authenticated;
grant execute on function public.place_table_order(text, jsonb) to anon, authenticated;
grant execute on function public.call_waiter(text, int, text) to anon, authenticated;
grant execute on function public.ask_table_bill(text) to anon, authenticated;
grant execute on function public.review_table_request(uuid, boolean, text) to authenticated;
