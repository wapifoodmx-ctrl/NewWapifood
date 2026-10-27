"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function KitchenBoard({ restaurantId, initialOrders, products }) {
  const [orders, setOrders] = useState(initialOrders);
  const supabase = useMemo(() => createClient(), []);
  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Producto";

  async function refresh() {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), dining_tables(number)")
      .eq("restaurant_id", restaurantId)
      .in("status", ["cocina", "lista"])
      .order("opened_at", { ascending: true });
    setOrders(data || []);
  }

  useEffect(() => {
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function markReady(id) {
    await supabase.from("orders").update({ status: "lista" }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "lista" } : o)));
  }

  async function markServed(id, tableId) {
    // Vuelve a abierta en piso / lista para cobro — mantiene mesa ocupada
    await supabase.from("orders").update({ status: "abierta" }).eq("id", id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-center">
        <p className="text-2xl font-semibold">Cocina libre</p>
        <p className="mt-2 text-[var(--color-muted)]">Las comandas aparecerán aquí al enviarse desde el POS.</p>
        <button type="button" onClick={refresh} className="mt-4 h-11 rounded-full bg-[var(--color-cream)] px-5 text-sm font-semibold">
          Actualizar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">Se actualiza sola cada 8 s</p>
        <button type="button" onClick={refresh} className="h-10 rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">
          Actualizar ahora
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl">Mesa {order.dining_tables?.number ?? "?"}</h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase text-white ${
                  order.status === "lista" ? "bg-[var(--color-sage)]" : "bg-[var(--color-ember)]"
                }`}
              >
                {order.status}
              </span>
            </div>
            <ul className="my-3 space-y-1">
              {(order.order_items || []).map((i) => (
                <li key={`${order.id}-${i.product_id}`} className="text-lg">
                  <span className="font-semibold">{i.qty}×</span> {nameOf(i.product_id)}
                </li>
              ))}
            </ul>
            {order.status === "cocina" ? (
              <button
                type="button"
                onClick={() => markReady(order.id)}
                className="h-11 w-full rounded-xl bg-[var(--color-sage)] font-semibold text-white"
              >
                Marcar lista
              </button>
            ) : (
              <button
                type="button"
                onClick={() => markServed(order.id, order.table_id)}
                className="h-11 w-full rounded-xl bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]"
              >
                Entregada al piso
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
