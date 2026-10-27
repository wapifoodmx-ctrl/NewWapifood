export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { TicketCard } from "@/components/TicketCard";
import { requireTenantWithPlan, requireTenantOperational } from "@/lib/auth";

export default async function TicketsPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantOperational();
  if (!membership?.restaurant_id) {
    return <AppShell title="Tickets" operational={operational} setupOnly={setupOnly}><p>Sin restaurante.</p></AppShell>;
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*), dining_tables(number)")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("status", "pagada")
    .order("closed_at", { ascending: false })
    .limit(50);

  const { data: products } = await supabase
    .from("products")
    .select("id,name")
    .eq("restaurant_id", membership.restaurant_id);
  const nameOf = (id) => products?.find((p) => p.id === id)?.name || "Producto";

  return (
    <AppShell title="Tickets" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-[var(--color-muted)]">Historial de cuentas pagadas. Puedes imprimir cada ticket.</p>
      <div className="space-y-3">
        {(orders || []).length === 0 ? (
          <p className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 text-[var(--color-muted)]">
            Aún no hay tickets.
          </p>
        ) : (
          (orders || []).map((o) => <TicketCard key={o.id} order={o} nameOf={nameOf} />)
        )}
      </div>
    </AppShell>
  );
}
