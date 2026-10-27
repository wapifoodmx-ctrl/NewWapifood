export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { InsumosManager } from "@/components/InsumosManager";
import { StockMovesList } from "@/components/StockMovesList";
import { requireTenant, requireTenantWithPlan } from "@/lib/auth";

export default async function InsumosPage() {
  const { supabase, membership } = await requireTenantWithPlan();
  if (!membership?.restaurant_id) {
    return <AppShell title="Insumos"><p>Sin restaurante.</p></AppShell>;
  }
  const rid = membership.restaurant_id;
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("*")
    .eq("restaurant_id", rid)
    .order("name");

  const ids = (ingredients || []).map((i) => i.id);
  let moves = [];
  if (ids.length) {
    const { data } = await supabase
      .from("stock_moves")
      .select("*")
      .in("ingredient_id", ids)
      .order("created_at", { ascending: false })
      .limit(30);
    moves = data || [];
  }

  const names = Object.fromEntries((ingredients || []).map((i) => [i.id, i.name]));

  return (
    <AppShell title="Insumos" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 max-w-2xl text-[var(--color-muted)]">
        Inventario unificado. El stock baja al cobrar si el producto tiene receta.
      </p>
      <InsumosManager restaurantId={rid} initialIngredients={ingredients || []} />
      <StockMovesList moves={moves} ingredientNames={names} />
    </AppShell>
  );
}
