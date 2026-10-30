-- Kardex: asegurar lectura de stock_moves para miembros
alter table public.stock_moves enable row level security;

drop policy if exists stock_moves_select on public.stock_moves;
drop policy if exists stock_moves_all on public.stock_moves;

create policy stock_moves_select on public.stock_moves
  for select to authenticated
  using (
    exists (
      select 1 from public.ingredients i
      where i.id = stock_moves.ingredient_id
        and public.is_member(i.restaurant_id)
    )
  );

grant select on public.stock_moves to authenticated;
