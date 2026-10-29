export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { RecetasManager } from "@/components/RecetasManager";
import { requireTenantSetup } from "@/lib/auth";

export default async function RecetasPage({ searchParams }) {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Recetas" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }

  const params = await searchParams;
  const focusProductId = params?.product || null;
  const rid = membership.restaurant_id;

  const [{ data: products }, { data: ingredients }, { data: lines }] = await Promise.all([
    supabase.from("products").select("id,name").eq("restaurant_id", rid).order("name"),
    supabase.from("ingredients").select("id,name,unit").eq("restaurant_id", rid).order("name"),
    supabase.from("recipe_lines").select("*"),
  ]);

  const productIds = new Set((products || []).map((p) => p.id));
  const scoped = (lines || []).filter((l) => productIds.has(l.product_id));

  return (
    <AppShell
      title="Recetas"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-[var(--color-muted)]">
        Define qué insumos consume cada producto. Al cobrar se descuenta el stock.
      </p>
      {(products || []).length === 0 || (ingredients || []).length === 0 ? (
        <p className="border border-[var(--color-line)] bg-[var(--color-paper)] p-5 text-[var(--color-muted)]">
          Primero crea productos en Carta e insumos en Insumos.
        </p>
      ) : (
        <RecetasManager
          products={products || []}
          ingredients={ingredients || []}
          initialLines={scoped}
          focusProductId={focusProductId}
        />
      )}
    </AppShell>
  );
}
