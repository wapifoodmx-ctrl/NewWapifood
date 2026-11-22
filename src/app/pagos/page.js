export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { SubscriptionPanel } from "@/components/SubscriptionPanel";
import { requireTenant } from "@/lib/auth";

export default async function PagosPage({ searchParams }) {
  const { supabase, membership, operational, setupOnly } = await requireTenant();
  const params = await searchParams;
  const locked = params?.motivo === "plan" || params?.motivo === "operacion";

  if (!membership?.restaurant_id) {
    return <AppShell title="Opciones de pago" operational={operational} setupOnly={setupOnly}><p>Sin restaurante.</p></AppShell>;
  }

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .order("created_at", { ascending: false });

  return (
    <AppShell title="Opciones de pago" operational={operational} setupOnly={setupOnly} restaurantName={membership.restaurants?.name} role={membership.role}>
      {locked ? (
        <div className="mb-4 rounded-2xl border border-[var(--color-ember)] bg-[var(--color-cream)] p-4 text-base">
          {params?.motivo === "operacion"
            ? "Todavía no puedes cobrar. Elige un plan aquí abajo. Mientras tanto sí puedes cargar productos, mesas y tu perfil."
            : "Tu plan no está activo. Elige uno para volver a vender."}
        </div>
      ) : null}
      <p className="mb-4 text-lg text-[var(--ink-soft)]">
        El plan se paga con Mercado Pago. Cuando el pago queda confirmado, el punto de venta, la cocina y los meseros ya se pueden usar.
      </p>
      <SubscriptionPanel restaurantId={membership.restaurant_id} initialSubs={subs || []} />
    </AppShell>
  );
}
