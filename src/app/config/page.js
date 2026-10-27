export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { ConfigPanel } from "@/components/ConfigPanel";
import { requireTenant } from "@/lib/auth";

export default async function ConfigPage() {
  const { supabase, membership } = await requireTenant();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Restaurante">
        <p>Sin restaurante. Recarga o vuelve a iniciar sesión.</p>
      </AppShell>
    );
  }

  const [{ data: restaurant }, { data: profile }] = await Promise.all([
    supabase.from("restaurants").select("*").eq("id", membership.restaurant_id).single(),
    supabase.from("restaurant_profiles").select("*").eq("restaurant_id", membership.restaurant_id).maybeSingle(),
  ]);

  return (
    <AppShell title="Restaurante" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Datos del local, contacto y logo (público para el menú digital).
      </p>
      <ConfigPanel restaurant={restaurant} profile={profile} />
    </AppShell>
  );
}
