-- IVA opcional, solo para mostrarlo en el ticket.
-- El precio de la carta ya es lo que se cobra. No se suma.

alter table public.restaurant_profiles
  add column if not exists iva_enabled boolean not null default false;
