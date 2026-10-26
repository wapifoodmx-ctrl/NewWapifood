"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

export function PosBoard({ restaurantId, tables, products, initialOrders }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeTableId, setActiveTableId] = useState(null);
  const [notice, setNotice] = useState("");
  const supabase = useMemo(() => createClient(), []);

  const order = orders.find((o) => o.table_id === activeTableId && o.status !== "pagada");

  async function refresh() {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", restaurantId)
      .neq("status", "pagada")
      .neq("status", "cancelada");
    setOrders(data || []);
  }

  async function openTable(tableId) {
    setActiveTableId(tableId);
    const existing = orders.find((o) => o.table_id === tableId && o.status !== "pagada");
    if (existing) return;
    const { data: created, error } = await supabase
      .from("orders")
      .insert({ restaurant_id: restaurantId, table_id: tableId, status: "abierta" })
      .select("*, order_items(*)")
      .single();
    if (error) return setNotice(error.message);
    await supabase.from("dining_tables").update({ state: "ocupada" }).eq("id", tableId);
    setOrders((prev) => [created, ...prev]);
  }

  async function addItem(product) {
    if (!order) return;
    const line = (order.order_items || []).find((i) => i.product_id === product.id);
    if (line) {
      await supabase
        .from("order_items")
        .update({ qty: line.qty + 1 })
        .eq("order_id", order.id)
        .eq("product_id", product.id);
    } else {
      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: product.id,
        qty: 1,
        unit_price: product.price,
      });
    }
    await refresh();
  }

  async function sendKitchen() {
    if (!order) return;
    await supabase.from("orders").update({ status: "cocina" }).eq("id", order.id);
    await refresh();
    setNotice("Comanda enviada a cocina");
  }

  async function pay(method) {
    if (!order) return;
    const { error } = await supabase.rpc("close_order", {
      p_order: order.id,
      p_method: method,
    });
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice(`Cobrado con ${method}`);
    setActiveTableId(null);
    await refresh();
  }

  const total = (order?.order_items || []).reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.qty),
    0,
  );

  const categories = [...new Set(products.map((p) => p.category_id))];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <h2 className="mb-3 text-3xl">Mesas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tables.map((t) => {
            const live = orders.find((o) => o.table_id === t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openTable(t.id)}
                className={`min-h-28 rounded-2xl border p-3 text-left ${
                  live
                    ? "border-[var(--color-ember)] bg-[var(--color-ember)] text-white"
                    : "border-[var(--color-line)] bg-[var(--color-paper)]"
                }`}
              >
                <p className="text-2xl font-semibold">Mesa {t.number}</p>
                <p className="text-sm opacity-80">{t.seats} lugares</p>
                <p className="mt-2 text-sm font-semibold">{live ? "Ocupada" : "Libre"}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        {!order ? (
          <p className="text-[var(--color-muted)]">Elige una mesa para abrir cuenta.</p>
        ) : (
          <>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                  {order.status}
                </p>
                <h2 className="text-3xl">Cuenta</h2>
              </div>
              <p className="text-2xl font-semibold">{money(total)}</p>
            </div>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p)}
                  className="min-h-16 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 py-2 text-left"
                >
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-sm text-[var(--color-muted)]">{money(p.price)}</span>
                </button>
              ))}
            </div>
            <ul className="mt-4 space-y-1 text-sm">
              {(order.order_items || []).map((i) => {
                const p = products.find((x) => x.id === i.product_id);
                return (
                  <li key={`${i.order_id}-${i.product_id}`} className="flex justify-between">
                    <span>
                      {i.qty} × {p?.name || "Producto"}
                    </span>
                    <span>{money(Number(i.unit_price) * Number(i.qty))}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={sendKitchen}
                className="h-12 rounded-xl bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]"
              >
                A cocina
              </button>
              <div className="grid grid-cols-3 gap-2">
                {["efectivo", "tarjeta", "transferencia"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pay(m)}
                    className="h-11 rounded-xl border border-[var(--color-line)] text-sm font-semibold capitalize"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {notice ? (
          <p className="mt-3 rounded-xl bg-[var(--color-cream)] px-3 py-2 text-sm">{notice}</p>
        ) : null}
      </section>
    </div>
  );
}
