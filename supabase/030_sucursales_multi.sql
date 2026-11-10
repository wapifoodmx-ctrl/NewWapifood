-- 030_sucursales_multi_restaurante.sql
-- Soporte multi-restaurante: caps por plan (mesas/meseros/locales) y creación de
-- restaurantes adicionales dentro del límite del plan.

-- Los topes viven en supabase/migrations/20261110043000_planes_brasa.sql.
-- Este archivo no se despliega. No vuelve a crear restaurant_caps para no pisarlos.

-- Crear un restaurante adicional dentro del límite del plan del owner.
create or replace function public.create_additional_restaurant(p_name text default 'Sucursal')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_base uuid;
  v_caps record;
  v_count integer;
  v_rid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  -- restaurante base del usuario (el que define el plan)
  select restaurant_id into v_base
  from public.memberships where user_id = v_uid
  order by created_at asc limit 1;
  if v_base is null then raise exception 'sin restaurante base'; end if;

  select * into v_caps from public.restaurant_caps(v_base);
  if v_caps is null or v_caps.max_restaurants is null then
    raise exception 'sin plan vigente para crear sucursales';
  end if;
  select count(*) into v_count from public.memberships where user_id = v_uid;
  if v_count >= v_caps.max_restaurants then
    raise exception 'límite de restaurantes del plan (%) alcanzado', v_caps.max_restaurants;
  end if;

  if v_name is null then v_name := 'Sucursal'; end if;
  insert into public.restaurants (name) values (v_name) returning id into v_rid;
  insert into public.memberships (restaurant_id, user_id, role) values (v_rid, v_uid, 'owner');

  -- semilla mínima (mesas + categorías) como en onboarding
  insert into public.dining_tables (restaurant_id, number, seats, state, active)
  select v_rid, n, case when n % 3 = 0 then 4 else 2 end, 'libre', true
  from generate_series(1, least(v_caps.max_mesas, 8)) as n;
  insert into public.categories (restaurant_id, name) values
    (v_rid, 'Tacos'), (v_rid, 'Antojitos'), (v_rid, 'Bebidas');

  return v_rid;
end;
$$;

revoke all on function public.create_additional_restaurant(text) from public;
grant execute on function public.create_additional_restaurant(text) to authenticated;
grant execute on function public.restaurant_caps(uuid) to authenticated;
