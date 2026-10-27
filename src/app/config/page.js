export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ThemePanel } from "@/components/ThemePanel";
import { requireTenant, requireTenantWithPlan, requireTenantSetup } from "@/lib/auth";

export default async function ConfigPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Restaurante" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante. Recarga o vuelve a iniciar sesión.</p>
      </AppShell>
    );
  }

  const [{ data: restaurant }, { data: profile }, { data: theme }] = await Promise.all([
    supabase.from("restaurants").select("*").eq("id", membership.restaurant_id).single(),
    supabase.from("restaurant_profiles").select("*").eq("restaurant_id", membership.restaurant_id).maybeSingle(),
    supabase.from("menu_theme").select("*").eq("restaurant_id", membership.restaurant_id).maybeSingle(),
  ]);

  return (
    <AppShell title="Restaurante" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-[var(--color-muted)]">
        Datos del local, contacto, logo y colores del menú digital.
      </p>
      <ConfigPanel restaurant={restaurant} profile={profile} />
      <ThemePanel restaurantId={membership.restaurant_id} initial={theme} />
    </AppShell>
  );
}
