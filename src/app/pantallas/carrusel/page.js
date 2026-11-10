export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { requireTenantOperational } from "@/lib/auth";
import { PantallasCarousel } from "@/components/PantallasCarousel";

export default async function PantallasCarruselPage() {
  const { membership, operational, setupOnly } = await requireTenantOperational();
  return (
    <AppShell
      title="Carrusel de pantallas"
      restaurantName={membership?.restaurants?.name}
      role={membership?.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <PantallasCarousel />
    </AppShell>
  );
}
