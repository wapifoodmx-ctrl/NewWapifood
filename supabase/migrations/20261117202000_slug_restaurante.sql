-- Un restaurante nuevo también necesita slug para el QR fijo.

create or replace function public.fill_restaurant_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    update public.restaurants
      set slug = left(trim(both '-' from lower(regexp_replace(coalesce(new.name, 'local'), '[^a-zA-Z0-9]+', '-', 'g'))), 40)
        || '-' || left(new.id::text, 8)
    where id = new.id
      and (slug is null or btrim(slug) = '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_restaurant_slug on public.restaurants;
create trigger trg_fill_restaurant_slug
  after insert on public.restaurants
  for each row execute function public.fill_restaurant_slug();

update public.restaurants
set slug = left(trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))), 40) || '-' || left(id::text, 8)
where slug is null or btrim(slug) = '';
