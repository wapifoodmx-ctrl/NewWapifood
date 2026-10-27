export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { SubscriptionPanel } from "@/components/SubscriptionPanel";
import { requireTenant } from "@/lib/auth";

export default async function PagosPage({ searchParams }) {
  const { supabase, membership } = await requireTenant();
  const params = await searchParams;
  const locked = params?.motivo === "plan";

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
      {locked ? (
        <div className="mb-4 rounded-2xl border border-[var(--color-ember)] bg-[var(--color-cream)] p-4 text-sm">
          Tu periodo de prueba o plan venció. Activa un plan para seguir usando el panel.
        </div>
      ) : null}
      <p className="mb-4 text-[var(--color-muted)]">
        Plan SaaS del restaurante. Activación automática en modo prueba; la pasarela real se conecta después.
      </p>
      <SubscriptionPanel restaurantId={membership.restaurant_id} initialSubs={subs || []} />
    </AppShell>
  );
}
