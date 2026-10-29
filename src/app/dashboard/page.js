export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { money } from "@/lib/format";
import { requireTenantSetup } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import { planMeta } from "@/lib/plans";
import { DashboardInsights } from "@/components/DashboardInsights";

export default async function DashboardPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  const restaurantId = membership?.restaurant_id;
  const restaurantName = membership?.restaurants?.name || "Mi restaurante";

  let openTables = 0;
  let openOrders = 0;
  let sales = 0;
  let ticketCount = 0;
  let lowStock = [];
  let expiring = [];
  let series = [0, 0, 0, 0, 0, 0, 0];
  let salesSeries = [0, 0, 0, 0, 0, 0, 0];
  let byChannel = {};
  let topProducts = [];
  let pendingWeb = 0;
  let sub = null;
  let productNames = {};
  let list = [];

  if (restaurantId) {
    const [{ count: ot }, { data: orders }, { data: ings }, { data: subs }, { data: products }] =
      await Promise.all([
        supabase
          .from("dining_tables")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .eq("state", "ocupada"),
        supabase
          .from("orders")
          .select(
            "id,status,source,opened_at,closed_at,order_type,order_items(qty,unit_price,product_id)",
          )
          .eq("restaurant_id", restaurantId),
        supabase
          .from("ingredients")
          .select("name,stock,min_stock,unit,kind,expires_on")
          .eq("restaurant_id", restaurantId),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("products").select("id,name").eq("restaurant_id", restaurantId),
      ]);

    openTables = ot || 0;
    list = orders || [];
    openOrders = list.filter((o) => !["pagada", "cancelada"].includes(o.status)).length;
    pendingWeb = list.filter((o) => o.status === "pendiente").length;
    const paid = list.filter((o) => o.status === "pagada");
    ticketCount = paid.length;
    sales = paid.reduce(
      (s, o) =>
        s + (o.order_items || []).reduce((a, i) => a + Number(i.unit_price) * Number(i.qty), 0),
      0,
    );

    byChannel = {};
    for (const o of paid) {
      const src = o.source || "pos";
      const amt = (o.order_items || []).reduce(
        (a, i) => a + Number(i.unit_price) * Number(i.qty),
        0,
      );
      byChannel[src] = (byChannel[src] || 0) + amt;
    }

    const prodMap = Object.fromEntries((products || []).map((p) => [p.id, p.name]));
    productNames = prodMap;
    const qtyByProd = {};
    for (const o of paid) {
      for (const i of o.order_items || []) {
        const id = i.product_id;
        qtyByProd[id] = (qtyByProd[id] || 0) + Number(i.qty);
      }
    }
    topProducts = Object.entries(qtyByProd)
      .map(([id, qty]) => ({ name: prodMap[id] || "Producto", qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    lowStock = (ings || []).filter((i) => Number(i.stock) <= Number(i.min_stock));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiring = (ings || []).filter((i) => {
      if (i.kind !== "perecedero" || !i.expires_on) return false;
      const d = new Date(i.expires_on + "T00:00:00");
      const days = Math.round((d - today) / 86400000);
      return days <= 7;
    });
    sub = (subs || [])[0] || null;

    const now = new Date();
    series = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - idx));
      const key = day.toISOString().slice(0, 10);
      return paid.filter((o) => (o.closed_at || o.opened_at || "").slice(0, 10) === key).length;
    });
    salesSeries = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - idx));
      const key = day.toISOString().slice(0, 10);
      return paid
        .filter((o) => (o.closed_at || o.opened_at || "").slice(0, 10) === key)
        .reduce(
          (s, o) =>
            s + (o.order_items || []).reduce((a, i) => a + Number(i.unit_price) * Number(i.qty), 0),
          0,
        );
    });
  }

  const max = Math.max(...series, 1);
  const maxSales = Math.max(...salesSeries, 1);
  const plan = sub ? planMeta(sub.plan) : null;
  const channelEntries = Object.entries(byChannel).sort((a, b) => b[1] - a[1]);

  return (
    <AppShell
      title="Panel"
      restaurantName={restaurantName}
      role={membership?.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      {setupOnly ? (
        <p className="mb-4 border border-[var(--color-saffron-glow)] bg-[var(--color-paper)] p-3 text-sm">
          Estás en configuración (trial). Activa el plan en{" "}
          <Link href="/pagos" className="font-semibold underline">
            Pagos
          </Link>{" "}
          para vender.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ventas cobradas", value: money(sales) },
          { label: "Tickets pagados", value: String(ticketCount) },
          { label: "Órdenes abiertas", value: String(openOrders) },
          { label: "Mesas ocupadas", value: String(openTables) },
        ].map((c) => (
          <div key={c.label} className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      {pendingWeb > 0 ? (
        <p className="mt-4 border border-[var(--color-saffron-glow)] bg-[var(--color-paper)] p-3 text-sm">
          Tienes <strong>{pendingWeb}</strong> pedido(s) web pendientes de confirmar.{" "}
          <Link href="/cocina" className="font-semibold underline">
            Ir a cocina
          </Link>
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          <h2 className="text-xl font-normal">Tickets (7 días)</h2>
          <div className="mt-4 flex h-32 items-end gap-2">
            {series.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full bg-[var(--color-saffron-glow)]"
                  style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 1 }}
                />
                <span className="text-[10px] text-[var(--color-walnut)]">{v}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          <h2 className="text-xl font-normal">Ventas $ (7 días)</h2>
          <div className="mt-4 flex h-32 items-end gap-2">
            {salesSeries.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full bg-[var(--color-onyx-warm)]"
                  style={{ height: `${(v / maxSales) * 100}%`, minHeight: v ? 4 : 1 }}
                />
                <span className="text-[9px] text-[var(--color-walnut)]">{v ? Math.round(v) : 0}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          <h2 className="text-xl font-normal">Más vendidos</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {topProducts.length ? (
              topProducts.map((p) => (
                <li key={p.name} className="flex justify-between border-b border-[var(--color-warm-stone)] py-1">
                  <span>{p.name}</span>
                  <span className="font-semibold">{p.qty}</span>
                </li>
              ))
            ) : (
              <li className="text-[var(--color-walnut)]">Aún no hay ventas cobradas.</li>
            )}
          </ul>
        </section>

        <section className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          <h2 className="text-xl font-normal">Ventas por canal</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {channelEntries.length ? (
              channelEntries.map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-[var(--color-warm-stone)] py-1">
                  <span className="uppercase">{k}</span>
                  <span className="font-semibold">{money(v)}</span>
                </li>
              ))
            ) : (
              <li className="text-[var(--color-walnut)]">Sin datos de canal todavía.</li>
            )}
          </ul>
        </section>
      </div>

      {(lowStock.length > 0 || expiring.length > 0) && (
        <section className="mt-4 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          <h2 className="text-xl font-normal">Alertas de inventario</h2>
          {lowStock.length ? (
            <p className="mt-2 text-sm text-[var(--color-wine)]">
              Stock bajo: {lowStock.map((i) => i.name).join(", ")}
            </p>
          ) : null}
          {expiring.length ? (
            <p className="mt-1 text-sm text-[var(--color-saffron-glow)]">
              Por caducar: {expiring.map((i) => `${i.name}${i.expires_on ? ` (${i.expires_on})` : ""}`).join(", ")}
            </p>
          ) : null}
          <Link href="/insumos" className="mt-2 inline-block text-sm font-semibold underline">
            Ir a insumos
          </Link>
        </section>
      )}

      {plan ? (
        <p className="mt-4 text-sm text-[var(--color-espresso)]">
          Plan: <strong>{plan.title}</strong> ({sub?.status})
        </p>
      ) : null}

      <DashboardInsights orders={list} productNames={productNames} />

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-normal">Módulos</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3 text-sm font-semibold hover:border-[var(--color-saffron-glow)]"
            >
              {m.title}
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
