export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { money } from "@/lib/format";
import { getMembership, requireUser } from "@/lib/auth";

export default async function TicketsPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    return <AppShell title="Tickets"><p>Sin restaurante.</p></AppShell>;
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
    <AppShell title="Tickets" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">Historial de cuentas pagadas (últimas 50).</p>
      <div className="space-y-3">
        {(orders || []).length === 0 ? (
          <p className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 text-[var(--color-muted)]">
            Aún no hay tickets. Cobra una cuenta desde el punto de venta.
          </p>
        ) : (
          (orders || []).map((o) => {
            const total = (o.order_items || []).reduce(
              (s, i) => s + Number(i.unit_price) * Number(i.qty),
              0,
            );
            return (
              <article key={o.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xl font-semibold">Mesa {o.dining_tables?.number ?? "—"}</p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {o.method || "—"} · {o.closed_at ? new Date(o.closed_at).toLocaleString("es-MX") : ""}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold">{money(total)}</p>
                </div>
                <ul className="mt-2 text-sm text-[var(--color-muted)]">
                  {(o.order_items || []).map((i) => (
                    <li key={`${o.id}-${i.product_id}`}>
                      {i.qty} × {nameOf(i.product_id)} — {money(Number(i.unit_price) * Number(i.qty))}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
