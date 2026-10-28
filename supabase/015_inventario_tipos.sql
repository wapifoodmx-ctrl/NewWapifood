-- BLOQUE 4: Tipos de inventario (perecedero / no_perecedero)

alter table public.ingredients
  add column if not exists kind text not null default 'no_perecedero',
  add column if not exists expires_on date,
  add column if not exists notes text;

do $$ begin
  alter table public.ingredients drop constraint if exists ingredients_kind_check;
  alter table public.ingredients
    add constraint ingredients_kind_check
    check (kind in ('perecedero', 'no_perecedero'));
exception when others then null;
end $$;

comment on column public.ingredients.kind is 'perecedero | no_perecedero';
comment on column public.ingredients.expires_on is 'Fecha de caducidad (útil en perecederos)';
