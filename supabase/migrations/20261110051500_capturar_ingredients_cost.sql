-- Captura ingredients.cost, que ya está en la base viva y en ninguna migración.
-- numeric(10,2) not null default 0, check cost >= 0. No reescribe filas.

alter table public.ingredients
  add column if not exists cost numeric(10,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ingredients_cost_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_cost_check check (cost >= 0);
  end if;
end $$;
