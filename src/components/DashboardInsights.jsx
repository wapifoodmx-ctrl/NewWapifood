"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";

/**
 * Fase 8: rangos 7d / 30d / mes actual sobre órdenes ya cargadas.
 */
export function DashboardInsights({ orders, productNames }) {
  const [range, setRange] = useState("semana");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    if (range === "dia") {
      start.setHours(0, 0, 0, 0);
    } else if (range === "semana") {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (range === "mes") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === "anio") {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      start = from ? new Date(`${from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = to ? new Date(`${to}T23:59:59`) : now;
    }
    return (orders || []).filter((o) => {
      const d = new Date(o.closed_at || o.opened_at || 0);
      return d >= start && d <= end;
    });
  }, [orders, range, from, to]);

  const paid = filtered.filter((o) => o.status === "pagada");
  const sales = paid.reduce(
    (s, o) =>
      s + (o.order_items || []).reduce((a, i) => a + Number(i.unit_price) * Number(i.qty), 0),
    0,
  );

  const byChannel = {};
  for (const o of paid) {
    const src = o.source || "pos";
    const amt = (o.order_items || []).reduce(
      (a, i) => a + Number(i.unit_price) * Number(i.qty),
      0,
    );
    byChannel[src] = (byChannel[src] || 0) + amt;
  }

  const qtyByProd = {};
  for (const o of paid) {
    for (const i of o.order_items || []) {
      qtyByProd[i.product_id] = (qtyByProd[i.product_id] || 0) + Number(i.qty);
    }
  }
  const top = Object.entries(qtyByProd)
    .map(([id, qty]) => ({ name: productNames[id] || "Producto", qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  const nowChart = new Date();
  const bucketCount = range === "anio" ? 12 : range === "dia" ? 1 : range === "semana" ? 7 : range === "mes" ? nowChart.getDate() : 14;
  const series = Array.from({ length: bucketCount }, (_, idx) => {
    if (range === "anio") {
      return paid.filter((o) => {
        const d = new Date(o.closed_at || o.opened_at || 0);
        return d.getFullYear() === nowChart.getFullYear() && d.getMonth() === idx;
      }).length;
    }
    const day = new Date();
    day.setDate(day.getDate() - (bucketCount - 1 - idx));
    const key = day.toISOString().slice(0, 10);
    return paid.filter((o) => (o.closed_at || o.opened_at || "").slice(0, 10) === key).length;
  });
  const max = Math.max(...series, 1);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayOrders = (orders || []).filter(
    (o) => (o.opened_at || "").slice(0, 10) === todayKey && !["cancelada"].includes(o.status),
  );

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-1">
        {[
          { id: "dia", label: "Día" },
          { id: "semana", label: "Semana" },
          { id: "mes", label: "Mes" },
          { id: "anio", label: "Año" },
          { id: "rango", label: "Rango" },
        ].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={`cat-chip ${range === r.id ? "is-on" : ""}`}
          >
            {r.label}
          </button>
        ))}
        {range === "rango" ? (
          <div className="flex gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 card px-2 text-xs" aria-label="Desde" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 card px-2 text-xs" aria-label="Hasta" />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-base font-bold text-[var(--ink-soft)]">Ventas del periodo</p>
          <p className="text-2xl font-semibold">{money(sales)}</p>
        </div>
        <div className="card p-4">
          <p className="text-base font-bold text-[var(--ink-soft)]">Tickets pagados</p>
          <p className="text-2xl font-semibold">{paid.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-base font-bold text-[var(--ink-soft)]">Pedidos de hoy</p>
          <p className="text-2xl font-semibold">{todayOrders.length}</p>
        </div>
      </div>

      <section className="card p-4">
        <h2 className="text-xl font-normal">{range === "anio" ? "Tickets por mes" : "Tickets por día"}</h2>
        <div className="mt-4 flex h-28 items-end gap-1 overflow-x-auto">
          {series.map((v, i) => (
            <div key={i} className="flex min-w-[8px] flex-1 flex-col items-center gap-1">
              <div
                className="w-full bg-[var(--color-saffron-glow)]"
                style={{ height: `${(v / max) * 100}%`, minHeight: v ? 3 : 1 }}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-xl font-normal">Más vendidos (periodo)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {top.length ? (
              top.map((p) => (
                <li key={p.name} className="flex justify-between border-b border-[var(--color-warm-stone)] py-1">
                  <span>{p.name}</span>
                  <span className="font-semibold">{p.qty}</span>
                </li>
              ))
            ) : (
              <li className="text-[var(--color-walnut)]">Sin ventas en el periodo.</li>
            )}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="text-xl font-normal">Por canal (periodo)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(byChannel).length ? (
              Object.entries(byChannel)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between border-b border-[var(--color-warm-stone)] py-1">
                    <span className="uppercase">{k}</span>
                    <span className="font-semibold">{money(v)}</span>
                  </li>
                ))
            ) : (
              <li className="text-[var(--color-walnut)]">Sin datos.</li>
            )}
          </ul>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="text-xl font-normal">Pedidos de hoy</h2>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
          {todayOrders.length ? (
            todayOrders.slice(0, 25).map((o) => (
              <li key={o.id} className="flex justify-between border-b border-[var(--color-warm-stone)] py-1">
                <span>
                  {(o.source || "pos").toUpperCase()} · {statusMetaLabel(o.status)}
                </span>
                <span className="text-[var(--color-walnut)]">
                  {o.opened_at ? new Date(o.opened_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </li>
            ))
          ) : (
            <li className="text-[var(--color-walnut)]">Aún no hay pedidos hoy.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function statusMetaLabel(s) {
  const map = {
    pendiente: "Pendiente",
    abierta: "Abierta",
    cocina: "Cocina",
    lista: "Lista",
    entregada: "Entregada",
    pagada: "Pagada",
    cancelada: "Cancelada",
  };
  return map[s] || s;
}
