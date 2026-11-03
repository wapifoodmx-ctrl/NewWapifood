export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { WaitersPanel } from "@/components/WaitersPanel";
import { requireTenantSetup } from "@/lib/auth";
import { planMeta } from "@/lib/plans";

export default async function MeserosPage() {
  const { supabase, membership, operational, setupOnly, plan } = await requireTenantSetup();
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

  const stats = {};
  const paid = await supabase
    .from("orders")
    .select("waiter_id, order_items(qty, unit_price)")
    .eq("restaurant_id", rid)
    .eq("status", "pagada");
  if (!paid.error) {
    for (const order of paid.data || []) {
      if (!order.waiter_id) continue;
      const sales = (order.order_items || []).reduce((s, i) => s + Number(i.unit_price) * Number(i.qty), 0);
      const row = stats[order.waiter_id] || { tickets: 0, sales: 0 };
      row.tickets += 1;
      row.sales += sales;
      stats[order.waiter_id] = row;
    }
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
        waiterLimit={planMeta(plan?.plan).meseros}
        stats={stats}
      />
    </AppShell>
  );
}
