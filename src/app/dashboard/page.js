import { AppShell } from "@/components/AppShell";
import { money } from "@/lib/format";
import { getMembership, requireUser } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import Link from "next/link";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  const restaurantId = membership?.restaurant_id;
  const restaurantName = membership?.restaurants?.name || "Sin restaurante";

  let openTables = 0;
  let openOrders = 0;
  let sales = 0;
  let lowStock = [];

  if (restaurantId) {
    const [{ count: ot }, { data: orders }, { data: ings }] = await Promise.all([
      supabase
        .from("dining_tables")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("state", "ocupada"),
      supabase
        .from("orders")
        .select("id,status,order_items(qty,unit_price)")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("ingredients")
        .select("name,stock,min_stock,unit")
        .eq("restaurant_id", restaurantId),
    ]);
    openTables = ot || 0;
    openOrders = (orders || []).filter((o) => o.status !== "pagada" && o.status !== "cancelada").length;
    sales = (orders || [])
      .filter((o) => o.status === "pagada")
      .reduce(
        (s, o) =>
          s +
          (o.order_items || []).reduce((a, i) => a + Number(i.unit_price) * Number(i.qty), 0),
        0,
      );
    lowStock = (ings || []).filter((i) => Number(i.stock) <= Number(i.min_stock));
  }

  return (
    <AppShell title="Panel" restaurantName={restaurantName} role={membership?.role}>
      {!restaurantId ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
          <h2 className="text-2xl">Tu usuario aún no tiene restaurante</h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Ejecuta el seed y el bootstrap de owner, o crea membership en Supabase.
            UUID de usuario: <code className="rounded bg-[var(--color-cream)] px-1">{user.id}</code>
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Vendido (pagado)" value={money(sales)} />
            <Stat label="Mesas ocupadas" value={String(openTables)} />
            <Stat label="Cuentas abiertas" value={String(openOrders)} />
          </div>

          <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
            <h2 className="text-2xl">Alertas de stock</h2>
            {lowStock.length === 0 ? (
              <p className="mt-2 text-[var(--color-muted)]">Todo arriba del mínimo.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {lowStock.map((i) => (
                  <li key={i.name}>
                    {i.name}: {i.stock} {i.unit}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-2xl">Accesos rápidos</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.filter((m) => m.status === "live").map((m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 hover:border-[var(--color-ember)]"
                >
                  <p className="text-lg font-semibold">{m.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">legacy: {m.legacy}</p>
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
