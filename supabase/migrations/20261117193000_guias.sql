-- Recuerda qué guías ya vio cada persona, en cualquier dispositivo.

create table if not exists public.user_tour_seen (
  user_id uuid not null references auth.users (id) on delete cascade,
  tour_id text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, tour_id)
);

alter table public.user_tour_seen enable row level security;

drop policy if exists user_tour_seen_own on public.user_tour_seen;
create policy user_tour_seen_own
  on public.user_tour_seen
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.user_tour_seen from anon;
grant select, insert, update, delete on table public.user_tour_seen to authenticated;
