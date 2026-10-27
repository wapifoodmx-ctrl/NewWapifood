export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { WaitersPanel } from "@/components/WaitersPanel";
import { requireTenantWithPlan, requireTenantSetup, requireTenant } from "@/lib/auth";

export default async function MeserosPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return <AppShell title="Meseros" operational={operational} setupOnly={setupOnly}><p>Sin restaurante.</p></AppShell>;
  }
  const rid = membership.restaurant_id;
  const [{ data: waiters }, { data: tables }] = await Promise.all([
    supabase.from("waiters").select("*").eq("restaurant_id", rid).order("name"),
    supabase.from("dining_tables").select("*").eq("restaurant_id", rid).eq("active", true).order("number"),
  ]);

  let assignments = [];
  if ((waiters || []).length) {
    const ids = waiters.map((w) => w.id);
    const { data } = await supabase.from("waiter_tables").select("waiter_id,table_id").in("waiter_id", ids);
    assignments = data || [];
  }

  return (
    <AppShell title="Meseros" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-[var(--color-muted)]">
        Altas, códigos de acceso y asignación de mesas.
      </p>
      <WaitersPanel
        restaurantId={rid}
        initialWaiters={waiters || []}
        tables={tables || []}
        initialAssignments={assignments}
      />
    </AppShell>
  );
}
