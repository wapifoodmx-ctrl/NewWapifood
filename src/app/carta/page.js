export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { CartaManager } from "@/components/CartaManager";
import { requireTenant, requireTenantWithPlan } from "@/lib/auth";

export default async function CartaPage() {
  const { supabase, membership } = await requireTenantWithPlan();
  if (!membership?.restaurant_id) {
    return <AppShell title="Carta"><p>Sin restaurante.</p></AppShell>;
  }
  const rid = membership.restaurant_id;
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("restaurant_id", rid).order("name"),
    supabase.from("categories").select("*").eq("restaurant_id", rid).order("name"),
  ]);

  return (
    <AppShell title="Carta" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Alta y edición de productos, categorías, precios, costos y fotos.
      </p>
      <CartaManager
        restaurantId={rid}
        initialProducts={products || []}
        initialCategories={categories || []}
      />
    </AppShell>
  );
}
