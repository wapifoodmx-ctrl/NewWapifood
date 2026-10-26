"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function KitchenBoard({ initialOrders, products }) {
  const [orders, setOrders] = useState(initialOrders);
  const supabase = useMemo(() => createClient(), []);
  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Producto";

  async function markReady(id) {
    await supabase.from("orders").update({ status: "lista" }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "lista" } : o)));
  }

  if (orders.length === 0) {
    return <p className="text-[var(--color-muted)]">No hay comandas en cocina.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
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
              <li key={`${order.id}-${i.product_id}`}>
                {i.qty} × {nameOf(i.product_id)}
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
          ) : null}
        </article>
      ))}
    </div>
  );
}
