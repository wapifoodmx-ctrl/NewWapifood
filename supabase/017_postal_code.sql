alter table public.restaurant_profiles
  add column if not exists postal_code text;
