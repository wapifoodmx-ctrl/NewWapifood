export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { MesasManager } from "@/components/MesasManager";
import { requireTenant, requireTenantWithPlan } from "@/lib/auth";

export default async function MesasPage() {
  const { supabase, membership } = await requireTenantWithPlan();
  if (!membership?.restaurant_id) {
    return <AppShell title="Mesas"><p>Sin restaurante.</p></AppShell>;
  }
  const { data: tables } = await supabase
    .from("dining_tables")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .order("number");

  return (
    <AppShell title="Mesas" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Administra el número de mesas y lugares. Se usan en el punto de venta.
      </p>
      <MesasManager restaurantId={membership.restaurant_id} initialTables={tables || []} />
    </AppShell>
  );
}
