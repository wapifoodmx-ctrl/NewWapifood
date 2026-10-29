export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { InsumosManager } from "@/components/InsumosManager";
import { requireTenantSetup } from "@/lib/auth";

export default async function InsumosPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Insumos" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }

  const rid = membership.restaurant_id;
  const [{ data: ingredients }, { data: profile }] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id,name,unit,stock,min_stock,kind,expires_on,notes,created_at")
      .eq("restaurant_id", rid)
      .order("name"),
    supabase
      .from("restaurant_profiles")
      .select("inventory_pin")
      .eq("restaurant_id", rid)
      .maybeSingle(),
  ]);

  const ids = (ingredients || []).map((i) => i.id);
  let moves = [];
  if (ids.length) {
    const { data } = await supabase
      .from("stock_moves")
      .select("id,ingredient_id,qty,reason,created_at")
      .in("ingredient_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    moves = data || [];
  }

  return (
    <AppShell
      title="Insumos"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 max-w-2xl text-[var(--color-muted)]">
        Inventario unificado (paridad con `/inventarios` del Front): insumos, kardex, mermas, entradas y PIN.
      </p>
      <InsumosManager
        restaurantId={rid}
        initialIngredients={ingredients || []}
        initialMoves={moves}
        inventoryPin={profile?.inventory_pin || null}
      />
    </AppShell>
  );
}
