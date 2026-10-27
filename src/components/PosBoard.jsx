"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

export function PosBoard({ restaurantId, tables, products, categories, initialOrders }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeTableId, setActiveTableId] = useState(null);
  const [catFilter, setCatFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [lastTicket, setLastTicket] = useState(null);
  const supabase = useMemo(() => createClient(), []);

  const order = orders.find(
    (o) => o.table_id === activeTableId && o.status !== "pagada" && o.status !== "cancelada",
  );

  const productList = products.filter((p) => !catFilter || p.category_id === catFilter);
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

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
    setLastTicket(null);
    const existing = orders.find(
      (o) => o.table_id === tableId && o.status !== "pagada" && o.status !== "cancelada",
    );
    if (existing) return;
    const { data: created, error } = await supabase
      .from("orders")
      .insert({ restaurant_id: restaurantId, table_id: tableId, status: "abierta" })
      .select("*, order_items(*)")
      .single();
    if (error) return setNotice(error.message);
    await supabase.from("dining_tables").update({ state: "ocupada" }).eq("id", tableId);
    setOrders((prev) => [created, ...prev]);
    setNotice("Mesa abierta");
  }

  async function addItem(product) {
    if (!order) return;
    const line = (order.order_items || []).find((i) => i.product_id === product.id);
    if (line) {
      await supabase
        .from("order_items")
        .update({ qty: Number(line.qty) + 1 })
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

  async function changeQty(productId, delta) {
    if (!order) return;
    const line = (order.order_items || []).find((i) => i.product_id === productId);
    if (!line) return;
    const next = Number(line.qty) + delta;
    if (next <= 0) {
      await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id)
        .eq("product_id", productId);
    } else {
      await supabase
        .from("order_items")
        .update({ qty: next })
        .eq("order_id", order.id)
        .eq("product_id", productId);
    }
    await refresh();
  }

  async function sendKitchen() {
    if (!order) return;
    if (!(order.order_items || []).length) return setNotice("Agrega productos antes de enviar a cocina");
    await supabase.from("orders").update({ status: "cocina" }).eq("id", order.id);
    await refresh();
    setNotice("Comanda enviada a cocina");
  }

  async function cancelOrder() {
    if (!order) return;
    if (!confirm("¿Cancelar esta cuenta?")) return;
    await supabase.from("orders").update({ status: "cancelada" }).eq("id", order.id);
    await supabase.from("dining_tables").update({ state: "libre" }).eq("id", order.table_id);
    setActiveTableId(null);
    await refresh();
    setNotice("Cuenta cancelada");
  }

  async function pay(method) {
    if (!order) return;
    if (!(order.order_items || []).length) return setNotice("La cuenta está vacía");
    const snapshot = {
      table: tableMap.get(order.table_id)?.number,
      items: (order.order_items || []).map((i) => ({
        name: productMap.get(i.product_id)?.name || "Producto",
        qty: i.qty,
        total: Number(i.unit_price) * Number(i.qty),
      })),
      total: (order.order_items || []).reduce(
        (s, i) => s + Number(i.unit_price) * Number(i.qty),
        0,
      ),
      method,
    };
    const { error } = await supabase.rpc("close_order", {
      p_order: order.id,
      p_method: method,
    });
    if (error) {
      setNotice(error.message);
      return;
    }
    setLastTicket(snapshot);
    setNotice(`Cobrado con ${method}`);
    setActiveTableId(null);
    await refresh();
  }

  const total = (order?.order_items || []).reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.qty),
    0,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <h2 className="mb-3 text-3xl">Mesas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tables.filter((t) => t.active !== false).map((t) => {
            const live = orders.find(
              (o) => o.table_id === t.id && o.status !== "pagada" && o.status !== "cancelada",
            );
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openTable(t.id)}
                className={`min-h-28 rounded-2xl border p-3 text-left transition ${
                  activeTableId === t.id
                    ? "border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]/20"
                    : ""
                } ${
                  live
                    ? "border-[var(--color-ember)] bg-[var(--color-ember)] text-white"
                    : "border-[var(--color-line)] bg-[var(--color-paper)]"
                }`}
              >
                <p className="text-2xl font-semibold">Mesa {t.number}</p>
                <p className="text-sm opacity-80">{t.seats} lugares</p>
                <p className="mt-2 text-sm font-semibold">
                  {live ? `Ocupada · ${live.status}` : "Libre"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        {!order ? (
          <div>
            <p className="text-[var(--color-muted)]">Elige una mesa para abrir o continuar la cuenta.</p>
            {lastTicket ? (
              <div className="mt-4 rounded-xl bg-[var(--color-cream)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-sage)]">Último ticket</p>
                <p className="text-xl font-semibold">Mesa {lastTicket.table}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {lastTicket.items.map((i, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{i.qty} × {i.name}</span>
                      <span>{money(i.total)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between font-semibold">
                  <span>Total ({lastTicket.method})</span>
                  <span>{money(lastTicket.total)}</span>
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                  {order.status}
                </p>
                <h2 className="text-3xl">Mesa {tableMap.get(order.table_id)?.number}</h2>
              </div>
              <p className="text-2xl font-semibold">{money(total)}</p>
            </div>

            <div className="mb-2 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCatFilter("")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${!catFilter ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "bg-[var(--color-cream)]"}`}
              >
                Todos
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatFilter(c.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${catFilter === c.id ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "bg-[var(--color-cream)]"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto">
              {productList.map((p) => (
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

            <ul className="mt-4 space-y-2 text-sm">
              {(order.order_items || []).map((i) => {
                const p = productMap.get(i.product_id);
                return (
                  <li key={`${i.order_id}-${i.product_id}`} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">{p?.name || "Producto"}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => changeQty(i.product_id, -1)} className="h-8 w-8 rounded-full bg-[var(--color-cream)] font-bold">−</button>
                      <span className="w-6 text-center font-semibold">{i.qty}</span>
                      <button type="button" onClick={() => changeQty(i.product_id, 1)} className="h-8 w-8 rounded-full bg-[var(--color-cream)] font-bold">+</button>
                    </div>
                    <span className="w-20 text-right">{money(Number(i.unit_price) * Number(i.qty))}</span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 grid gap-2">
              <button type="button" onClick={sendKitchen} className="h-12 rounded-xl bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]">
                Enviar a cocina
              </button>
              <div className="grid grid-cols-3 gap-2">
                {["efectivo", "tarjeta", "transferencia"].map((m) => (
                  <button key={m} type="button" onClick={() => pay(m)} className="h-11 rounded-xl border border-[var(--color-line)] text-sm font-semibold capitalize">
                    {m}
                  </button>
                ))}
              </div>
              <button type="button" onClick={cancelOrder} className="h-10 text-sm font-semibold text-[var(--color-wine)]">
                Cancelar cuenta
              </button>
            </div>
          </>
        )}
        {notice ? <p className="mt-3 rounded-xl bg-[var(--color-cream)] px-3 py-2 text-sm">{notice}</p> : null}
      </section>
    </div>
  );
}
