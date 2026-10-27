export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { money } from "@/lib/format";
import { requireTenant } from "@/lib/auth";
import { MODULES } from "@/lib/modules";

export default async function DashboardPage() {
  const { supabase, membership } = await requireTenant();
  const restaurantId = membership?.restaurant_id;
  const restaurantName = membership?.restaurants?.name || "Mi restaurante";

  let openTables = 0;
  let openOrders = 0;
  let sales = 0;
  let ticketCount = 0;
  let lowStock = [];
  let series = [0, 0, 0, 0, 0, 0, 0];

  if (restaurantId) {
    const [{ count: ot }, { data: orders }, { data: ings }] = await Promise.all([
      supabase
        .from("dining_tables")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("state", "ocupada"),
      supabase
        .from("orders")
        .select("id,status,opened_at,order_items(qty,unit_price)")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("ingredients")
        .select("name,stock,min_stock,unit")
        .eq("restaurant_id", restaurantId),
    ]);

    openTables = ot || 0;
    const list = orders || [];
    openOrders = list.filter((o) => o.status !== "pagada" && o.status !== "cancelada").length;
    const paid = list.filter((o) => o.status === "pagada");
    ticketCount = paid.length;
    sales = paid.reduce(
      (s, o) =>
        s + (o.order_items || []).reduce((a, i) => a + Number(i.unit_price) * Number(i.qty), 0),
      0,
    );
    lowStock = (ings || []).filter((i) => Number(i.stock) <= Number(i.min_stock));

    // Serie simple últimos 7 días (conteo de órdenes pagadas)
    const now = new Date();
    series = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - idx));
      const key = day.toISOString().slice(0, 10);
      return paid.filter((o) => (o.opened_at || "").slice(0, 10) === key).length;
    });
  }

  const max = Math.max(...series, 1);

  return (
    <AppShell title="Panel" restaurantName={restaurantName} role={membership?.role}>
      {!restaurantId ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
          <h2 className="text-2xl">Activando tu restaurante…</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Si este mensaje no desaparece al recargar, falta ejecutar en Supabase el SQL
            <code className="mx-1 rounded bg-[var(--color-cream)] px-1">005_auto_onboarding.sql</code>
            (solo una vez, por el equipo técnico).
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Vendido (pagado)" value={money(sales)} />
            <Stat label="Tickets pagados" value={String(ticketCount)} />
            <Stat label="Mesas ocupadas" value={String(openTables)} />
            <Stat label="Cuentas abiertas" value={String(openOrders)} />
          </div>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
              <h2 className="text-2xl">Órdenes pagadas (7 días)</h2>
              <div className="mt-6 flex h-40 items-end gap-2">
                {series.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg bg-[var(--color-ember)]"
                      style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
                      title={`${v} órdenes`}
                    />
                    <span className="text-[10px] text-[var(--color-muted)]">D{i + 1}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
              <h2 className="text-2xl">Alertas de stock</h2>
              {lowStock.length === 0 ? (
                <p className="mt-3 text-[var(--color-muted)]">Sin alertas por ahora.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {lowStock.map((i) => (
                    <li key={i.name} className="text-[var(--color-wine)]">
                      {i.name}: {i.stock} {i.unit}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/insumos" className="mt-4 inline-flex h-10 items-center rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">
                Ver insumos
              </Link>
            </article>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-2xl">Módulos</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.filter((m) => m.href !== "/dashboard").map((m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 hover:border-[var(--color-ember)]"
                >
                  <p className="text-lg font-semibold">{m.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">{m.status}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value }) {
  return (
    <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </article>
  );
}
