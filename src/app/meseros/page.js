export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { WaitersPanel } from "@/components/WaitersPanel";
import { getMembership, requireUser } from "@/lib/auth";

export default async function MeserosPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    return <AppShell title="Meseros"><p>Sin restaurante.</p></AppShell>;
  }
  const { data: waiters } = await supabase
    .from("waiters")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .order("name");

  return (
    <AppShell title="Meseros" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Migración de <code>pages/meseros.js</code>. Requiere tablas del SQL 004.
      </p>
      <WaitersPanel restaurantId={membership.restaurant_id} initialWaiters={waiters || []} />
    </AppShell>
  );
}
