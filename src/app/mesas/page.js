export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { MesasManager } from "@/components/MesasManager";
import { requireTenantSetup } from "@/lib/auth";
import { planMeta } from "@/lib/plans";

export default async function MesasPage() {
  const { supabase, membership, operational, setupOnly, plan } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return <AppShell title="Mesas" operational={operational} setupOnly={setupOnly}><p>Sin restaurante.</p></AppShell>;
  }
  const { data: tables } = await supabase
    .from("dining_tables")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .order("number");

  return (
    <AppShell title="Mesas" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-base text-[var(--ink-soft)]">
        Verde y una palomita es libre. Ámbar y personas es ocupada. Gris y el círculo es no disponible. El color siempre va con la palabra.
      </p>
      <MesasManager
        restaurantId={membership.restaurant_id}
        initialTables={tables || []}
        tableLimit={plan?.plan ? planMeta(plan.plan).mesas : null}
      />
    </AppShell>
  );
}
