export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { ComprasPanel } from "@/components/ComprasPanel";
import { requireTenantSetup } from "@/lib/auth";

export default async function ComprasPage() {
  const { membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Compras" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  return (
    <AppShell title="Compras" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-base text-[var(--ink-soft)]">Registra lo que compras. El stock sube y el costo de esa compra se usa en el margen de la receta.</p>
      <ComprasPanel restaurantId={membership.restaurant_id} />
    </AppShell>
  );
}
