-- Grupos de modificadores: mÃ­nimo, mÃ¡ximo y obligatorio.
-- El precio del modificador se suma por pieza, igual que un adicional.
-- No borra extras viejos.

create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  min_select integer not null default 0,
  max_select integer not null default 1,
  required boolean not null default false,
  check (min_select >= 0 and max_select >= 1 and max_select >= min_select)
);

create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  extra_price numeric(10,2) not null default 0 check (extra_price >= 0)
);

create table if not exists public.product_modifier_groups (
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  primary key (product_id, group_id)
);

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  option_id uuid references public.modifier_options(id) on delete set null,
  name text not null,
  extra_price numeric(10,2) not null default 0
);

create index if not exists modifier_groups_restaurant_idx on public.modifier_groups (restaurant_id);
create index if not exists modifier_options_group_idx on public.modifier_options (group_id);
create index if not exists order_item_modifiers_line_idx on public.order_item_modifiers (order_item_id);

alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.order_item_modifiers enable row level security;

drop policy if exists modifier_groups_select on public.modifier_groups;
create policy modifier_groups_select on public.modifier_groups
  for select to anon, authenticated
  using (
    public.is_member(restaurant_id)
    or exists (
      select 1 from public.product_modifier_groups pg
      join public.products p on p.id = pg.product_id
      where pg.group_id = modifier_groups.id and p.active = true
    )
  );

drop policy if exists modifier_groups_write on public.modifier_groups;
create policy modifier_groups_write on public.modifier_groups
  for all to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

drop policy if exists modifier_options_select on public.modifier_options;
create policy modifier_options_select on public.modifier_options
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.modifier_groups g
      where g.id = group_id and (
        public.is_member(g.restaurant_id)
        or exists (
          select 1 from public.product_modifier_groups pg
          join public.products p on p.id = pg.product_id
          where pg.group_id = g.id and p.active = true
        )
      )
    )
  );

drop policy if exists modifier_options_write on public.modifier_options;
create policy modifier_options_write on public.modifier_options
  for all to authenticated
  using (
    exists (select 1 from public.modifier_groups g where g.id = group_id and public.is_member(g.restaurant_id))
  )
  with check (
    exists (select 1 from public.modifier_groups g where g.id = group_id and public.is_member(g.restaurant_id))
  );

drop policy if exists product_modifier_groups_select on public.product_modifier_groups;
create policy product_modifier_groups_select on public.product_modifier_groups
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (public.is_member(p.restaurant_id) or p.active = true)
    )
  );

drop policy if exists product_modifier_groups_write on public.product_modifier_groups;
create policy product_modifier_groups_write on public.product_modifier_groups
  for all to authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and public.is_member(p.restaurant_id))
  )
  with check (
    exists (select 1 from public.products p where p.id = product_id and public.is_member(p.restaurant_id))
  );

drop policy if exists order_item_modifiers_select on public.order_item_modifiers;
create policy order_item_modifiers_select on public.order_item_modifiers
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and public.is_member(o.restaurant_id))
  );

drop policy if exists order_item_modifiers_write on public.order_item_modifiers;
create policy order_item_modifiers_write on public.order_item_modifiers
  for all to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and public.is_member(o.restaurant_id))
  )
  with check (
    exists (select 1 from public.orders o where o.id = order_id and public.is_member(o.restaurant_id))
  );

revoke all on table public.modifier_groups from public, anon, authenticated;
revoke all on table public.modifier_options from public, anon, authenticated;
revoke all on table public.product_modifier_groups from public, anon, authenticated;
revoke all on table public.order_item_modifiers from public, anon, authenticated;
grant select on table public.modifier_groups to anon, authenticated;
grant select, insert, update, delete on table public.modifier_groups to authenticated;
grant select on table public.modifier_options to anon, authenticated;
grant select, insert, update, delete on table public.modifier_options to authenticated;
grant select on table public.product_modifier_groups to anon, authenticated;
grant select, insert, update, delete on table public.product_modifier_groups to authenticated;
grant select, insert, update, delete on table public.order_item_modifiers to authenticated;

create or replace function public.order_subtotal(p_order uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    greatest(0,
      ((oi.unit_price + coalesce(ex.extra_sum, ex_old.extra_sum, 0) + coalesce(md.mod_sum, 0)) * oi.qty)
      - case
          when oi.discount_type = 'porcentaje'
            then ((oi.unit_price + coalesce(ex.extra_sum, ex_old.extra_sum, 0) + coalesce(md.mod_sum, 0)) * oi.qty) * coalesce(oi.discount_value, 0) / 100
          when oi.discount_type = 'monto' then coalesce(oi.discount_value, 0)
          else 0
        end
    )
  ), 0)
  from public.order_items oi
  left join (
    select order_item_id, sum(extra_price) as extra_sum
    from public.order_item_extras
    where order_item_id is not null
    group by order_item_id
  ) ex on ex.order_item_id = oi.id
  left join (
    select order_id, product_id, sum(extra_price) as extra_sum
    from public.order_item_extras
    where order_item_id is null
    group by order_id, product_id
  ) ex_old on ex_old.order_id = oi.order_id and ex_old.product_id = oi.product_id
  left join (
    select order_item_id, sum(extra_price) as mod_sum
    from public.order_item_modifiers
    group by order_item_id
  ) md on md.order_item_id = oi.id
  where oi.order_id = p_order
    and coalesce(oi.status, 'pendiente') <> 'cancelado';
$$;

revoke all on function public.order_subtotal(uuid) from public, anon;
grant execute on function public.order_subtotal(uuid) to authenticated;
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
  v_line uuid;
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
  r record;
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
    on conflict (order_id, product_id, (coalesce(notes, ''))) do update
      set qty = public.order_items.qty + excluded.qty,
          notes = coalesce(excluded.notes, public.order_items.notes),
          status = case
            when public.order_items.status = 'cancelado' then 'pendiente'
            else public.order_items.status
          end
    returning id into v_line;

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
        insert into public.order_item_extras (order_id, product_id, order_item_id, ingredient_id, qty, extra_price)
        values (v_order, v_pid, v_line, v_ing, v_extra_qty, v_extra_price)
        on conflict (order_item_id, ingredient_id) do update
          set qty = excluded.qty, extra_price = excluded.extra_price;
      end loop;
    end if;
  end loop;

    if v_item ? 'modifiers' and jsonb_typeof(v_item->'modifiers') = 'array' then
      for v_ex in select * from jsonb_array_elements(v_item->'modifiers')
      loop
        insert into public.order_item_modifiers (order_item_id, order_id, option_id, name, extra_price)
        select v_line, v_order, o.id, o.name, o.extra_price
        from public.modifier_options o
        join public.product_modifier_groups pg on pg.group_id = o.group_id and pg.product_id = v_pid
        where o.id = nullif(v_ex->>'option_id', '')::uuid;
      end loop;
    end if;
    for r in
      select g.name, g.min_select, g.max_select, g.required,
        (
          select count(*)
          from public.order_item_modifiers m
          join public.modifier_options o on o.id = m.option_id
          where m.order_item_id = v_line and o.group_id = g.id
        ) as picked
      from public.modifier_groups g
      join public.product_modifier_groups pg on pg.group_id = g.id
      where pg.product_id = v_pid
    loop
      if r.picked < case when r.required then greatest(r.min_select, 1) else r.min_select end then
        raise exception 'en % hay que elegir más opciones', r.name;
      end if;
      if r.picked > r.max_select then
        raise exception 'en % hay demasiadas opciones', r.name;
      end if;
    end loop;
  return v_order;
end;
$$;


revoke all on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.place_public_order(uuid, uuid, jsonb, text, text, text, text, text, text, text) to anon, authenticated;

