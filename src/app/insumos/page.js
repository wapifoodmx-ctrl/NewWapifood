export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { InsumosManager } from "@/components/InsumosManager";
import { requireTenant } from "@/lib/auth";

export default async function InsumosPage() {
  const { supabase, membership } = await requireTenant();
  if (!membership?.restaurant_id) {
    return <AppShell title="Insumos"><p>Sin restaurante.</p></AppShell>;
  }
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .order("name");

  return (
    <AppShell title="Insumos" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 max-w-2xl text-[var(--color-muted)]">
        Inventario unificado (antes microservicio). El stock se descuenta al cobrar si el producto tiene receta.
      </p>
      <InsumosManager restaurantId={membership.restaurant_id} initialIngredients={ingredients || []} />
    </AppShell>
  );
}
