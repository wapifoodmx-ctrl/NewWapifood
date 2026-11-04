export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { ReportesPanel } from "@/components/ReportesPanel";
import { requireTenantSetup } from "@/lib/auth";

export default async function ReportesPage() {
  const { membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Reportes" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  return (
    <AppShell
      title="Reportes"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-base text-[var(--ink-soft)]">
        Cuentas cobradas en hora de la Ciudad de México. El total de alimentos ya resta los descuentos. La propina va aparte.
      </p>
      <ReportesPanel restaurantId={membership.restaurant_id} />
    </AppShell>
  );
}
