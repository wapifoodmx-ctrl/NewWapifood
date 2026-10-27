export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { SubscriptionPanel } from "@/components/SubscriptionPanel";
import { requireTenant } from "@/lib/auth";

export default async function PagosPage() {
  const { supabase, membership } = await requireTenant();
  if (!membership?.restaurant_id) {
    return <AppShell title="Pagos"><p>Sin restaurante.</p></AppShell>;
  }

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .order("created_at", { ascending: false });

  return (
    <AppShell title="Pagos / plan" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Plan SaaS del restaurante. Hoy la activación es manual de prueba; la pasarela (Stripe/Mercado Pago) se conecta después sin cambiar el modelo.
      </p>
      <SubscriptionPanel restaurantId={membership.restaurant_id} initialSubs={subs || []} />
    </AppShell>
  );
}
