-- 030_sucursales_multi_restaurante.sql
-- Soporte multi-restaurante: caps por plan (mesas/meseros/locales) y creación de
-- restaurantes adicionales dentro del límite del plan.

-- 1) Caps por plan (actualizado a los nuevos precios/nombres y multi).
-- DROP previo: el retorno cambia (agrega max_restaurants), Postgres no permite
-- cambiar el tipo de retorno de una función existente con CREATE OR REPLACE.
drop function if exists public.restaurant_caps(uuid);

create or replace function public.restaurant_caps(p_restaurant uuid)
returns table (max_mesas integer, max_meseros integer, max_restaurants integer, plan text)
language sql
stable
security definer
set search_path = public
as $$
  select
    case coalesce(s.plan, 'ventas')
      when 'restaurante' then 15 when 'profesional' then 15
      when 'plus' then 25 when 'empresarial' then 25
      when 'restaurante_multi' then 15 when 'franquicia' then 15
      when 'plus_multi' then 25 when 'corporativo' then 25
      when 'ventas_multi' then 5 when 'cadena' then 5
      else 5 end,
    case coalesce(s.plan, 'ventas')
      when 'restaurante' then 7 when 'profesional' then 7
      when 'plus' then 15 when 'empresarial' then 15
      when 'restaurante_multi' then 7 when 'franquicia' then 7
      when 'plus_multi' then 15 when 'corporativo' then 15
      when 'ventas_multi' then 3 when 'cadena' then 3
      else 3 end,
    case coalesce(s.plan, 'ventas')
      when 'ventas_multi' then 3 when 'cadena' then 3
      when 'restaurante_multi' then 5 when 'franquicia' then 5
      when 'plus_multi' then 8 when 'corporativo' then 8
      else 1 end,
    coalesce(s.plan, 'ventas')
  from public.subscriptions s
  where s.restaurant_id = p_restaurant
    and s.status in ('active', 'trialing')
    and (s.ends_at is null or s.ends_at > now())
  order by s.created_at desc
  limit 1;
$$;

-- 2) Crear un restaurante adicional dentro del límite del plan del owner.
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
