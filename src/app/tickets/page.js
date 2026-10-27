export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { TicketCard } from "@/components/TicketCard";
import { requireTenantOperational } from "@/lib/auth";

export default async function TicketsPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantOperational();

  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Tickets" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }

  const rid = membership.restaurant_id;

  const [{ data: orders, error: ordersError }, { data: products }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,status,method,opened_at,closed_at,table_id,order_items(product_id,qty,unit_price),dining_tables(number)",
      )
      .eq("restaurant_id", rid)
      .eq("status", "pagada")
      .order("closed_at", { ascending: false })
      .limit(50),
    supabase.from("products").select("id,name").eq("restaurant_id", rid),
  ]);

  const productNames = Object.fromEntries((products || []).map((p) => [p.id, p.name]));

  return (
    <AppShell
      title="Tickets"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-[var(--color-muted)]">
        Historial de cuentas pagadas. Ruta: <code className="rounded bg-[var(--color-cream)] px-1">/tickets</code>
      </p>

      {ordersError ? (
        <div className="mb-4 rounded-2xl border border-[var(--color-wine)] bg-[var(--color-paper)] p-5 text-sm text-[var(--color-wine)]">
          No se pudieron cargar los tickets: {ordersError.message}
        </div>
      ) : null}

      <div className="space-y-3">
        {(orders || []).length === 0 ? (
          <p className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 text-[var(--color-muted)]">
            Aún no hay tickets. Cobra una mesa en el Punto de venta y aparecerán aquí.
          </p>
        ) : (
          (orders || []).map((o) => (
            <TicketCard key={o.id} order={o} productNames={productNames} />
          ))
        )}
      </div>
    </AppShell>
  );
}
