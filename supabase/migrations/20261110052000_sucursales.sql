-- Sucursales: un grupo, una suscripción, varios locales.
-- Corre después de 20261110043000_planes_brasa.sql (usa plan_caps_for).
-- Aditiva: no borra tablas, columnas ni filas de negocio.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid,
  billing_restaurant_id uuid,
  created_at timestamptz not null default now(),
  constraint organizations_name_check check (char_length(name) >= 2 and char_length(name) <= 80)
);

alter table public.restaurants
  add column if not exists organization_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_organization_id_fkey'
  ) then
    alter table public.restaurants
      add constraint restaurants_organization_id_fkey
      foreign key (organization_id) references public.organizations(id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_billing_restaurant_id_fkey'
  ) then
    alter table public.organizations
      add constraint organizations_billing_restaurant_id_fkey
      foreign key (billing_restaurant_id) references public.restaurants(id) on delete set null;
  end if;
end $$;

create index if not exists restaurants_organization_id_idx
  on public.restaurants (organization_id);

-- Un grupo por dueño. Los locales que ya son de esa persona quedan juntos.
insert into public.organizations (name, owner_user_id)
select r.name, owners.user_id
from (
  select distinct on (m.user_id) m.user_id, m.restaurant_id
  from public.memberships m
  join public.restaurants r on r.id = m.restaurant_id
  where m.role = 'owner'
    and r.organization_id is null
    and not exists (
      select 1 from public.organizations o where o.owner_user_id = m.user_id
    )
  order by m.user_id, m.created_at
) owners
join public.restaurants r on r.id = owners.restaurant_id;

update public.restaurants r
set organization_id = o.id
from public.memberships m
join public.organizations o on o.owner_user_id = m.user_id
where m.restaurant_id = r.id
  and m.role = 'owner'
  and r.organization_id is null;

insert into public.organizations (name, billing_restaurant_id)
select r.name, r.id
from public.restaurants r
where r.organization_id is null;

update public.restaurants r
set organization_id = o.id
from public.organizations o
where o.billing_restaurant_id = r.id
  and r.organization_id is null;

update public.organizations o
set billing_restaurant_id = pick.restaurant_id
from (
  select distinct on (r.organization_id)
    r.organization_id,
    s.restaurant_id
  from public.restaurants r
  join public.subscriptions s on s.restaurant_id = r.id
  where r.organization_id is not null
    and s.status in ('active', 'trialing')
    and (s.ends_at is null or s.ends_at > now())
  order by r.organization_id, s.created_at desc
) pick
where o.id = pick.organization_id;

update public.organizations o
set billing_restaurant_id = pick.restaurant_id
from (
  select distinct on (organization_id) organization_id, id as restaurant_id
  from public.restaurants
  where organization_id is not null
  order by organization_id, created_at
) pick
where o.id = pick.organization_id
  and o.billing_restaurant_id is null;

insert into public.memberships (restaurant_id, user_id, role)
select r.id, o.owner_user_id, 'owner'::public.app_role
from public.restaurants r
join public.organizations o on o.id = r.organization_id
where o.owner_user_id is not null
on conflict (restaurant_id, user_id) do nothing;

create or replace function public.attach_restaurant_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is not null then
    update public.organizations
    set billing_restaurant_id = coalesce(billing_restaurant_id, new.id)
    where id = new.organization_id
      and billing_restaurant_id is null;
    return new;
  end if;

  insert into public.organizations (name, owner_user_id, billing_restaurant_id)
  values (new.name, auth.uid(), new.id)
  returning id into v_org;

  update public.restaurants
  set organization_id = v_org
  where id = new.id
    and organization_id is null;

  return new;
end;
$$;

drop trigger if exists trg_attach_restaurant_org on public.restaurants;
create trigger trg_attach_restaurant_org
  after insert on public.restaurants
  for each row execute function public.attach_restaurant_org();

alter table public.organizations enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.restaurants r
      join public.memberships m on m.restaurant_id = r.id
      where r.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

revoke all on table public.organizations from public, anon, authenticated;
grant select on table public.organizations to authenticated;

-- El dueño del grupo ve todos los locales, aunque falte una fila de membresía.
create or replace function public.is_member(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = rid and m.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.restaurants r
    join public.organizations o on o.id = r.organization_id
    where r.id = rid
      and o.owner_user_id = auth.uid()
  );
$$;

-- Una suscripción del local que cobra cubre a todo el grupo.
create or replace function public.restaurant_caps(p_restaurant uuid)
returns table (
  max_mesas integer,
  max_meseros integer,
  max_restaurants integer,
  plan text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.max_mesas, c.max_meseros, c.max_restaurants, c.plan
  from public.restaurants here
  left join public.organizations o on o.id = here.organization_id
  join public.restaurants sib
    on sib.id = here.id
    or sib.organization_id = here.organization_id
  join public.subscriptions s on s.restaurant_id = sib.id
  cross join lateral public.plan_caps_for(s.plan) c
  where here.id = p_restaurant
    and s.status in ('active', 'trialing')
    and (s.ends_at is null or s.ends_at > now())
    and c.plan is not null
  order by
    (sib.id = coalesce(o.billing_restaurant_id, p_restaurant)) desc,
    s.created_at desc
  limit 1;
$$;

-- Una persona puede aceptar invitaciones de varios locales.
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
    insert into public.memberships (restaurant_id, user_id, role)
    values (inv.restaurant_id, v_uid, inv.role)
    on conflict (restaurant_id, user_id) do nothing;
    update public.team_invites set accepted_at = now() where id = inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

drop function if exists public.create_additional_restaurant(text);

create or replace function public.create_additional_restaurant(
  p_name text default 'Sucursal',
  p_restaurant uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_owner uuid;
  v_caps record;
  v_count integer;
  v_rid uuid;
  v_anchor uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'el nombre debe tener al menos 2 letras';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'el nombre es demasiado largo';
  end if;

  if p_restaurant is not null then
    if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
    select organization_id into v_org from public.restaurants where id = p_restaurant;
    v_anchor := p_restaurant;
  else
    select r.organization_id, r.id into v_org, v_anchor
    from public.memberships m
    join public.restaurants r on r.id = m.restaurant_id
    where m.user_id = v_uid and m.role = 'owner'
    order by m.created_at
    limit 1;
  end if;

  if v_org is null then raise exception 'sin grupo para crear sucursales'; end if;

  if not exists (
    select 1
    from public.memberships m
    join public.restaurants r on r.id = m.restaurant_id
    where m.user_id = v_uid
      and r.organization_id = v_org
      and m.role in ('owner', 'admin')
  ) and not exists (
    select 1 from public.organizations o
    where o.id = v_org and o.owner_user_id = v_uid
  ) then
    raise exception 'sin permiso para crear sucursales';
  end if;

  select * into v_caps from public.restaurant_caps(v_anchor);
  if v_caps.max_restaurants is null then
    raise exception 'sin plan vigente para crear sucursales';
  end if;

  select count(*) into v_count
  from public.restaurants
  where organization_id = v_org;
  if v_count >= v_caps.max_restaurants then
    raise exception 'límite de restaurantes del plan (%) alcanzado', v_caps.max_restaurants;
  end if;

  select owner_user_id into v_owner from public.organizations where id = v_org;
  if v_owner is null then
    update public.organizations set owner_user_id = v_uid where id = v_org;
    v_owner := v_uid;
  end if;

  insert into public.restaurants (name, organization_id)
  values (v_name, v_org)
  returning id into v_rid;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_rid, v_owner, 'owner')
  on conflict (restaurant_id, user_id) do nothing;

  if v_uid is distinct from v_owner then
    insert into public.memberships (restaurant_id, user_id, role)
    values (v_rid, v_uid, 'admin')
    on conflict (restaurant_id, user_id) do nothing;
  end if;

  insert into public.restaurant_profiles (
    restaurant_id, confirmation_code, require_confirm_code, delivery_enabled
  ) values (
    v_rid,
    lpad((floor(random() * 10000))::int::text, 4, '0'),
    true,
    false
  )
  on conflict (restaurant_id) do nothing;

  insert into public.dining_tables (restaurant_id, number, seats, state, active, channel_type)
  select v_rid, n, case when n % 3 = 0 then 4 else 2 end, 'libre', true, 'piso'
  from generate_series(1, least(coalesce(v_caps.max_mesas, 5), 8)) as n;

  insert into public.categories (restaurant_id, name) values
    (v_rid, 'Tacos'), (v_rid, 'Antojitos'), (v_rid, 'Bebidas');

  return v_rid;
end;
$$;

create or replace function public.list_org_access(p_restaurant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  if not public.has_role(p_restaurant, array['owner', 'admin']::public.app_role[])
     and not exists (
       select 1
       from public.restaurants r
       join public.organizations o on o.id = r.organization_id
       where r.id = p_restaurant and o.owner_user_id = auth.uid()
     ) then
    raise exception 'sin permiso';
  end if;

  select organization_id into v_org from public.restaurants where id = p_restaurant;

  select jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name) order by r.created_at)
      from public.restaurants r
      where r.organization_id = v_org
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', u.id,
        'email', u.email,
        'access', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'restaurant_id', m.restaurant_id,
            'role', m.role
          )), '[]'::jsonb)
          from public.memberships m
          join public.restaurants r on r.id = m.restaurant_id
          where m.user_id = u.id and r.organization_id = v_org
        )
      ) order by u.email)
      from (
        select distinct m.user_id
        from public.memberships m
        join public.restaurants r on r.id = m.restaurant_id
        where r.organization_id = v_org
      ) ids
      join auth.users u on u.id = ids.user_id
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.grant_location_access(
  p_user uuid,
  p_restaurant uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_role not in ('admin', 'piso', 'cocina') then raise exception 'rol inválido'; end if;
  v_role := p_role::public.app_role;

  select organization_id into v_org from public.restaurants where id = p_restaurant;
  if v_org is null then raise exception 'local sin grupo'; end if;

  if not exists (
    select 1
    from public.memberships m
    join public.restaurants r on r.id = m.restaurant_id
    where m.user_id = auth.uid()
      and r.organization_id = v_org
      and m.role in ('owner', 'admin')
  ) and not exists (
    select 1 from public.organizations o
    where o.id = v_org and o.owner_user_id = auth.uid()
  ) then
    raise exception 'sin permiso';
  end if;

  if not exists (
    select 1
    from public.memberships m
    join public.restaurants r on r.id = m.restaurant_id
    where m.user_id = p_user and r.organization_id = v_org
  ) then
    raise exception 'esa persona todavía no está en el grupo. invítala por correo';
  end if;

  if exists (
    select 1 from public.memberships
    where restaurant_id = p_restaurant and user_id = p_user and role = 'owner'
  ) then
    raise exception 'el dueño ya entra a ese local';
  end if;

  insert into public.memberships (restaurant_id, user_id, role)
  values (p_restaurant, p_user, v_role)
  on conflict (restaurant_id, user_id) do update
    set role = excluded.role
    where public.memberships.role <> 'owner';
end;
$$;

create or replace function public.copy_restaurant_menu(p_from uuid, p_to uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_from uuid;
  v_org_to uuid;
  v_count integer := 0;
  cat record;
  prod record;
  extra record;
  recipe record;
  pic record;
  lst record;
  item record;
  v_cat uuid;
  v_prod uuid;
  v_ing uuid;
  v_list uuid;
  v_cats jsonb := '{}'::jsonb;
  v_prods jsonb := '{}'::jsonb;
  v_ings jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_from = p_to then raise exception 'elige otro local'; end if;
  if not public.is_member(p_from) or not public.is_member(p_to) then
    raise exception 'sin permiso';
  end if;
  if not public.has_role(p_from, array['owner', 'admin']::public.app_role[])
     or not public.has_role(p_to, array['owner', 'admin']::public.app_role[]) then
    raise exception 'solo dueño o administración pueden copiar el menú';
  end if;

  select organization_id into v_org_from from public.restaurants where id = p_from;
  select organization_id into v_org_to from public.restaurants where id = p_to;
  if v_org_from is null or v_org_from is distinct from v_org_to then
    raise exception 'los locales no son del mismo grupo';
  end if;

  for cat in
    select id, name, sort_order from public.categories
    where restaurant_id = p_from
    order by sort_order, name
  loop
    select id into v_cat
    from public.categories
    where restaurant_id = p_to and name = cat.name;
    if v_cat is null then
      insert into public.categories (restaurant_id, name, sort_order)
      values (p_to, cat.name, cat.sort_order)
      returning id into v_cat;
    end if;
    v_cats := v_cats || jsonb_build_object(cat.id::text, v_cat);
  end loop;

  for prod in
    select * from public.products where restaurant_id = p_from order by name
  loop
    v_cat := nullif(v_cats ->> prod.category_id::text, '')::uuid;
    if v_cat is null then
      continue;
    end if;
    insert into public.products (
      restaurant_id, category_id, name, price, cost, active, description, image_url, inventory_mode
    ) values (
      p_to, v_cat, prod.name, prod.price, prod.cost, prod.active,
      prod.description, prod.image_url, prod.inventory_mode
    )
    returning id into v_prod;
    v_prods := v_prods || jsonb_build_object(prod.id::text, v_prod);
    v_count := v_count + 1;
  end loop;

  for extra in
    select pe.product_id, pe.ingredient_id, pe.qty, pe.extra_price, i.name, i.unit, i.kind, i.is_extra, i.cost
    from public.product_extras pe
    join public.ingredients i on i.id = pe.ingredient_id
    where (v_prods ? pe.product_id::text)
  loop
    v_ing := nullif(v_ings ->> extra.ingredient_id::text, '')::uuid;
    if v_ing is null then
      select id into v_ing
      from public.ingredients
      where restaurant_id = p_to and name = extra.name;
      if v_ing is null then
        insert into public.ingredients (
          restaurant_id, name, unit, stock, min_stock, kind, is_extra, cost
        ) values (
          p_to, extra.name, extra.unit, 0, 0, extra.kind, extra.is_extra, coalesce(extra.cost, 0)
        )
        returning id into v_ing;
      end if;
      v_ings := v_ings || jsonb_build_object(extra.ingredient_id::text, v_ing);
    end if;
    v_prod := nullif(v_prods ->> extra.product_id::text, '')::uuid;
    insert into public.product_extras (product_id, ingredient_id, qty, extra_price)
    values (v_prod, v_ing, extra.qty, extra.extra_price)
    on conflict (product_id, ingredient_id) do nothing;
  end loop;

  for recipe in
    select rl.product_id, rl.ingredient_id, rl.qty, i.name, i.unit, i.kind, i.is_extra, i.cost
    from public.recipe_lines rl
    join public.ingredients i on i.id = rl.ingredient_id
    where (v_prods ? rl.product_id::text)
  loop
    v_ing := nullif(v_ings ->> recipe.ingredient_id::text, '')::uuid;
    if v_ing is null then
      select id into v_ing
      from public.ingredients
      where restaurant_id = p_to and name = recipe.name;
      if v_ing is null then
        insert into public.ingredients (
          restaurant_id, name, unit, stock, min_stock, kind, is_extra, cost
        ) values (
          p_to, recipe.name, recipe.unit, 0, 0, recipe.kind, recipe.is_extra, coalesce(recipe.cost, 0)
        )
        returning id into v_ing;
      end if;
      v_ings := v_ings || jsonb_build_object(recipe.ingredient_id::text, v_ing);
    end if;
    v_prod := nullif(v_prods ->> recipe.product_id::text, '')::uuid;
    insert into public.recipe_lines (product_id, ingredient_id, qty)
    values (v_prod, v_ing, recipe.qty)
    on conflict (product_id, ingredient_id) do nothing;
  end loop;

  for pic in
    select pi.product_id, pi.path
    from public.product_images pi
    where (v_prods ? pi.product_id::text)
  loop
    v_prod := nullif(v_prods ->> pic.product_id::text, '')::uuid;
    insert into public.product_images (product_id, path) values (v_prod, pic.path);
  end loop;

  for lst in
    select id, name from public.product_lists where restaurant_id = p_from order by created_at
  loop
    insert into public.product_lists (restaurant_id, name)
    values (p_to, lst.name)
    returning id into v_list;
    for item in
      select pli.product_id, pli.sort_order
      from public.product_list_items pli
      where pli.list_id = lst.id
    loop
      v_prod := nullif(v_prods ->> item.product_id::text, '')::uuid;
      if v_prod is null then continue; end if;
      insert into public.product_list_items (list_id, product_id, sort_order)
      values (v_list, v_prod, item.sort_order);
    end loop;
  end loop;

  return v_count;
end;
$$;

create or replace function public.sales_report_locations(
  p_restaurant uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  loc record;
  part jsonb;
  rows jsonb := '[]'::jsonb;
  v jsonb;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if not public.is_member(p_restaurant) then raise exception 'sin permiso'; end if;
  select organization_id into v_org from public.restaurants where id = p_restaurant;
  if v_org is null then raise exception 'local sin grupo'; end if;

  for loc in
    select r.id, r.name
    from public.restaurants r
    where r.organization_id = v_org
      and public.is_member(r.id)
    order by r.created_at
  loop
    part := public.sales_report(loc.id, p_from, p_to);
    rows := rows || jsonb_build_array(jsonb_build_object(
      'restaurant_id', loc.id,
      'name', loc.name,
      'tickets', coalesce(part->'tickets', '0'::jsonb),
      'food', coalesce(part->'food', '0'::jsonb),
      'tips', coalesce(part->'tips', '0'::jsonb),
      'discounts', coalesce(part->'discounts', '0'::jsonb)
    ));
  end loop;

  select jsonb_build_object(
    'locations', rows,
    'tickets', coalesce(sum((x->>'tickets')::numeric), 0),
    'food', coalesce(round(sum((x->>'food')::numeric), 2), 0),
    'tips', coalesce(round(sum((x->>'tips')::numeric), 2), 0),
    'discounts', coalesce(round(sum((x->>'discounts')::numeric), 2), 0)
  )
  into v
  from jsonb_array_elements(rows) x;

  if v is null then
    v := jsonb_build_object(
      'locations', '[]'::jsonb,
      'tickets', 0,
      'food', 0,
      'tips', 0,
      'discounts', 0
    );
  end if;
  return v;
end;
$$;

revoke all on function public.attach_restaurant_org() from public, anon, authenticated;
revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to anon, authenticated;
revoke all on function public.restaurant_caps(uuid) from public, anon, authenticated;
revoke all on function public.accept_team_invites() from public, anon, authenticated;
revoke all on function public.create_additional_restaurant(text, uuid) from public, anon, authenticated;
revoke all on function public.list_org_access(uuid) from public, anon, authenticated;
revoke all on function public.grant_location_access(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.copy_restaurant_menu(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sales_report_locations(uuid, date, date) from public, anon, authenticated;

grant execute on function public.restaurant_caps(uuid) to authenticated;
grant execute on function public.accept_team_invites() to authenticated;
grant execute on function public.create_additional_restaurant(text, uuid) to authenticated;
grant execute on function public.list_org_access(uuid) to authenticated;
grant execute on function public.grant_location_access(uuid, uuid, text) to authenticated;
grant execute on function public.copy_restaurant_menu(uuid, uuid) to authenticated;
grant execute on function public.sales_report_locations(uuid, date, date) to authenticated;
