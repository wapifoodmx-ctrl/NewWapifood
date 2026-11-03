-- Fase 2: orden de categorías en carta
alter table public.categories
  add column if not exists sort_order int not null default 0;

-- backfill suave
with ranked as (
  select id, row_number() over (partition by restaurant_id order by name) - 1 as rn
  from public.categories
)
update public.categories c
set sort_order = ranked.rn
from ranked
where c.id = ranked.id and c.sort_order = 0;
