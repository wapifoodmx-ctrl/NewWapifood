export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { ChecadorPanel } from "@/components/ChecadorPanel";
import { requireTenantSetup } from "@/lib/auth";

export default async function ChecadorPage() {
  const { membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Checador" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  return (
    <AppShell title="Checador" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-base text-[var(--ink-soft)]">Marca la entrada y la salida. Esas horas se usan para repartir la propina.</p>
      <ChecadorPanel restaurantId={membership.restaurant_id} />
    </AppShell>
  );
}
