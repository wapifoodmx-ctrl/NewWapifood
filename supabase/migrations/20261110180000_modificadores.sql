-- Grupos de modificadores: mínimo, máximo y obligatorio.
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
