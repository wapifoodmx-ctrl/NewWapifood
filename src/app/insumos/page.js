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

  // Select amplio: si fallan columnas nuevas, cae a columnas base (como Recetas)
  let ingredients = [];
  let loadError = null;

  {
    const full = await supabase
      .from("ingredients")
      .select("id,name,unit,stock,min_stock,kind,expires_on,notes,created_at,restaurant_id")
      .eq("restaurant_id", rid)
      .order("name");

    if (full.error) {
      const basic = await supabase
        .from("ingredients")
        .select("id,name,unit,stock,min_stock,restaurant_id")
        .eq("restaurant_id", rid)
        .order("name");

      if (basic.error) {
        loadError = basic.error.message || full.error.message;
        ingredients = [];
      } else {
        ingredients = (basic.data || []).map((i) => ({
          ...i,
          kind: i.kind || "no_perecedero",
          expires_on: i.expires_on || null,
          notes: i.notes || null,
        }));
      }
    } else {
      ingredients = full.data || [];
    }
  }

  const { data: profile } = await supabase
    .from("restaurant_profiles")
    .select("inventory_pin")
    .eq("restaurant_id", rid)
    .maybeSingle();

  const ids = ingredients.map((i) => i.id);
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
      {loadError ? (
        <p className="mb-4 border border-[var(--color-wine)] bg-[var(--color-paper)] p-3 text-sm text-[var(--color-wine)]">
          Error al cargar insumos: {loadError}
        </p>
      ) : null}
      <InsumosManager
        restaurantId={rid}
        initialIngredients={ingredients}
        initialMoves={moves}
        inventoryPin={profile?.inventory_pin || null}
      />
    </AppShell>
  );
}
