-- Enlaza TU usuario autenticado como owner del restaurante demo.
-- 1) Crea cuenta en Authentication → Users (o desde el login de la app).
-- 2) Copia el UUID del usuario.
-- 3) Reemplaza 'PEGA-AQUI-TU-USER-UUID' y ejecuta.

insert into public.memberships (restaurant_id, user_id, role)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'PEGA-AQUI-TU-USER-UUID',
  'owner'
)
on conflict (restaurant_id, user_id) do update set role = excluded.role;
