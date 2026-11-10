export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { PropinasPanel } from "@/components/PropinasPanel";
import { requireTenantSetup } from "@/lib/auth";

export default async function PropinasPage() {
  const { membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Propinas" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  return (
    <AppShell
      title="Reparto de propinas"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-base text-[var(--ink-soft)]">
        Aquí ves la propina por mesero, por forma de pago y por día. Luego puedes cerrar el reparto.
      </p>
      <PropinasPanel restaurantId={membership.restaurant_id} />
    </AppShell>
  );
}
