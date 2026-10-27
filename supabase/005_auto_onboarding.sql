-- Onboarding automático SaaS (el cliente NUNCA toca SQL)
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

  insert into public.dining_tables (restaurant_id, number, seats, state, active)
  select v_rid, n, case when n % 3 = 0 then 4 else 2 end, 'libre', true
  from generate_series(1, 8) as n;

  insert into public.categories (restaurant_id, name) values
    (v_rid, 'Tacos'),
    (v_rid, 'Antojitos'),
    (v_rid, 'Bebidas');

  return v_rid;
end;
$$;

revoke all on function public.create_my_restaurant(text) from public;
grant execute on function public.create_my_restaurant(text) to authenticated;
