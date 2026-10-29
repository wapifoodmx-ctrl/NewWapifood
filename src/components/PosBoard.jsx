"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

/**
 * POS — paridad gradual con Puntodeventa (CarritoModal + ModalsPago).
 */
export function PosBoard({ restaurantId, tables, products, categories, initialOrders }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeTableId, setActiveTableId] = useState(null);
  const [catFilter, setCatFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);

  // Modales (paridad Front)
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("efectivo");
  const [cashGiven, setCashGiven] = useState("");
  const [noteEdit, setNoteEdit] = useState(null); // { productId, notes }

  const supabase = useMemo(() => createClient(), []);

  const order = orders.find(
    (o) => o.table_id === activeTableId && o.status !== "pagada" && o.status !== "cancelada",
  );

  const productList = products.filter((p) => p.active !== false && (!catFilter || p.category_id === catFilter));
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const floorTables = tables.filter((t) => t.channel_type !== "kiosko" && t.active !== false);
  const sortedTables = [...floorTables].sort((a, b) => {
    const rank = (t) => (t.channel_type === "caja" ? 0 : 1);
    return rank(a) - rank(b) || Number(a.number) - Number(b.number);
  });

  const total = useMemo(() => {
    return (order?.order_items || []).reduce(
      (s, i) => s + Number(i.unit_price) * Number(i.qty),
      0,
    );
  }, [order]);

  const itemCount = (order?.order_items || []).reduce((s, i) => s + Number(i.qty), 0);

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
    setLoading(true);
    const { data: created, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        status: "abierta",
        source: "pos",
      })
      .select("*, order_items(*)")
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("dining_tables").update({ state: "ocupada" }).eq("id", tableId);
    setOrders((prev) => [created, ...prev]);
    toast.success("Mesa abierta");
  }

  async function addItem(product) {
    if (!order) {
      toast.warning("Elige una mesa primero");
      return;
    }
    setLoading(true);
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
        notes: null,
      });
    }
    await refresh();
    setLoading(false);
    toast.info(`${product.name} agregado`);
  }

  async function changeQty(productId, delta) {
    if (!order) return;
    const line = (order.order_items || []).find((i) => i.product_id === productId);
    if (!line) return;
    const next = Number(line.qty) + delta;
    setLoading(true);
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
    setLoading(false);
  }

  async function saveNote() {
    if (!order || !noteEdit) return;
    setLoading(true);
    const { error } = await supabase
      .from("order_items")
      .update({ notes: noteEdit.notes?.trim() || null })
      .eq("order_id", order.id)
      .eq("product_id", noteEdit.productId);
    setLoading(false);
    if (error) {
      toast.error(error.message + (error.message?.includes("notes") ? " — ¿SQL 021?" : ""));
      return;
    }
    setNoteEdit(null);
    await refresh();
    toast.success("Comentario guardado");
  }

  async function sendKitchen() {
    if (!order) return;
    if (!(order.order_items || []).length) {
      toast.warning("La cuenta está vacía");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("orders").update({ status: "cocina" }).eq("id", order.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    await refresh();
    setCartOpen(false);
    toast.success("Enviado a cocina");
  }

  async function cancelOrder() {
    if (!order) return;
    if (
      !(await confirmAsync("¿Cancelar esta cuenta? Se liberará la mesa si no hay otra orden.", {
        title: "Cancelar cuenta",
        confirmLabel: "Cancelar cuenta",
        cancelLabel: "Volver",
      }))
    ) {
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("cancel_order", {
      p_order: order.id,
      p_reason: "Cancelada en punto de venta",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setActiveTableId(null);
    setCartOpen(false);
    await refresh();
    toast.success("Cuenta cancelada");
  }

  function openPay() {
    if (!order) return;
    if (!(order.order_items || []).length) {
      toast.warning("No hay productos que cobrar");
      return;
    }
    setPayMethod("efectivo");
    setCashGiven("");
    setPayOpen(true);
  }

  async function confirmPay() {
    if (!order) return;
    if (payMethod === "efectivo") {
      const given = Number(cashGiven);
      if (!Number.isNaN(given) && given > 0 && given < total) {
        toast.error("El efectivo recibido es menor al total");
        return;
      }
    }
    setLoading(true);
    const snapshot = {
      items: (order.order_items || []).map((i) => ({
        name: productMap.get(i.product_id)?.name || "Producto",
        qty: i.qty,
        line: Number(i.unit_price) * Number(i.qty),
        notes: i.notes,
      })),
      total,
      method: payMethod,
      table: tableMap.get(order.table_id)?.number,
      cashGiven: payMethod === "efectivo" ? Number(cashGiven) || null : null,
    };
    const { error } = await supabase.rpc("close_order", {
      p_order: order.id,
      p_method: payMethod,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLastTicket(snapshot);
    setPayOpen(false);
    setCartOpen(false);
    setActiveTableId(null);
    await refresh();
    toast.success(`Cobrado con ${payMethod}`);
  }

  const change =
    payMethod === "efectivo" && Number(cashGiven) > 0 ? Number(cashGiven) - total : null;

  return (
    <div className="relative grid gap-4 lg:grid-cols-[240px_1fr]">
      <LoadingOverlay visible={loading} message="Procesando POS…" />

      {/* Mesas */}
      <aside className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-3">
        <h2 className="text-lg font-normal">Mesas</h2>
        <p className="mb-2 text-[11px] text-[var(--color-walnut)]">Caja primero · sin kiosko</p>
        <div className="grid grid-cols-2 gap-2">
          {sortedTables.map((t) => {
            const live = orders.find(
              (o) =>
                o.table_id === t.id && o.status !== "pagada" && o.status !== "cancelada",
            );
            const active = activeTableId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openTable(t.id)}
                className={`min-h-[72px] border px-2 py-2 text-left ${
                  active
                    ? "border-[var(--color-onyx-warm)] bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                    : "border-[var(--color-warm-stone)] bg-[var(--color-parchment)]"
                }`}
              >
                <span className="block text-sm font-semibold">
                  {t.channel_type === "caja" ? "Caja" : `Mesa ${t.number}`}
                </span>
                <span className="text-[11px] opacity-80">
                  {live ? `Ocupada · ${live.status}` : "Libre"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Catálogo + resumen */}
      <section className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
        {!activeTableId ? (
          <p className="text-[var(--color-espresso)]">Selecciona una mesa o la caja para comenzar.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-normal">
                  {tableMap.get(activeTableId)?.channel_type === "caja"
                    ? "Caja"
                    : `Mesa ${tableMap.get(activeTableId)?.number}`}
                </h2>
                <p className="text-sm text-[var(--color-espresso)]">
                  Estado: {order?.status || "—"} · {itemCount} ítem(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="h-11 rounded-[3px] bg-[var(--color-saffron-glow)] px-4 text-xs font-semibold uppercase text-[var(--color-midnight-roast)]"
              >
                Ver carrito · {money(total)}
              </button>
            </div>

            <div className="mt-3 flex gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setCatFilter("")}
                className={`shrink-0 rounded-[3px] px-3 py-2 text-xs font-semibold uppercase ${
                  !catFilter ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-parchment)]"
                }`}
              >
                Todos
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatFilter(c.id)}
                  className={`shrink-0 rounded-[3px] px-3 py-2 text-xs font-semibold uppercase ${
                    catFilter === c.id
                      ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                      : "bg-[var(--color-parchment)]"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {productList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p)}
                  className="min-h-16 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 py-2 text-left"
                >
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-sm text-[var(--color-espresso)]">{money(p.price)}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={sendKitchen}
                className="h-12 rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]"
              >
                Enviar a cocina
              </button>
              <button
                type="button"
                onClick={openPay}
                className="h-12 rounded-[3px] border border-[var(--color-warm-stone)] text-xs font-semibold uppercase"
              >
                Cobrar
              </button>
              <button
                type="button"
                onClick={cancelOrder}
                className="h-12 text-xs font-semibold uppercase text-[var(--color-wine)]"
              >
                Cancelar cuenta
              </button>
            </div>
          </>
        )}

        {lastTicket ? (
          <div className="mt-4 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--color-saffron-glow)]">Último ticket</p>
            <p className="font-semibold">
              Mesa {lastTicket.table} · {lastTicket.method}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {lastTicket.items.map((i, idx) => (
                <li key={idx}>
                  {i.qty} × {i.name}
                  {i.notes ? ` (${i.notes})` : ""} — {money(i.line)}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-semibold">{money(lastTicket.total)}</p>
            {lastTicket.cashGiven ? (
              <p className="text-sm text-[var(--color-espresso)]">
                Recibido {money(lastTicket.cashGiven)} · cambio{" "}
                {money(Math.max(0, lastTicket.cashGiven - lastTicket.total))}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Modal carrito — paridad CarritoModal */}
      {cartOpen && order ? (
        <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--color-warm-stone)] bg-[var(--color-paper)] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3">
              <h2 className="text-xl font-normal">Carrito</h2>
              <button type="button" onClick={() => setCartOpen(false)} className="text-xs font-semibold uppercase">
                Cerrar
              </button>
            </div>
            <ul className="space-y-3 p-4">
              {(order.order_items || []).map((i) => {
                const p = productMap.get(i.product_id);
                return (
                  <li key={`${i.order_id}-${i.product_id}`} className="border border-[var(--color-warm-stone)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{p?.name || "Producto"}</p>
                        {i.notes ? (
                          <p className="text-xs text-[var(--color-saffron-glow)]">{i.notes}</p>
                        ) : null}
                      </div>
                      <span className="font-semibold">{money(Number(i.unit_price) * Number(i.qty))}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => changeQty(i.product_id, -1)} className="h-9 w-9 border border-[var(--color-warm-stone)] font-bold">
                        −
                      </button>
                      <span className="w-8 text-center font-semibold">{i.qty}</span>
                      <button type="button" onClick={() => changeQty(i.product_id, 1)} className="h-9 w-9 border border-[var(--color-warm-stone)] font-bold">
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs font-semibold uppercase"
                        onClick={() => setNoteEdit({ productId: i.product_id, notes: i.notes || "" })}
                      >
                        Comentario
                      </button>
                    </div>
                  </li>
                );
              })}
              {!(order.order_items || []).length ? (
                <p className="text-[var(--color-walnut)]">Carrito vacío</p>
              ) : null}
            </ul>
            <div className="border-t border-[var(--color-warm-stone)] p-4">
              <p className="mb-3 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={sendKitchen} className="h-12 rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]">
                  Enviar a cocina
                </button>
                <button type="button" onClick={openPay} className="h-12 rounded-[3px] border border-[var(--color-warm-stone)] text-xs font-semibold uppercase">
                  Cobrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal comentario línea */}
      {noteEdit ? (
        <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-6">
            <h2 className="text-xl font-normal">Comentario del producto</h2>
            <p className="text-sm text-[var(--color-espresso)]">Ej. sin cebolla, término medio…</p>
            <textarea
              value={noteEdit.notes}
              onChange={(e) => setNoteEdit((n) => ({ ...n, notes: e.target.value }))}
              rows={3}
              className="mt-3 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 py-2"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNoteEdit(null)} className="h-11 px-4 text-xs font-semibold uppercase">
                Cancelar
              </button>
              <button type="button" onClick={saveNote} className="h-11 bg-[var(--color-onyx-warm)] px-4 text-xs font-semibold uppercase text-[var(--color-parchment)]">
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal pago — paridad ModalsPago */}
      {payOpen ? (
        <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-6">
            <h2 className="text-2xl font-normal">Cobrar cuenta</h2>
            <p className="mt-1 text-3xl font-semibold">{money(total)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["efectivo", "tarjeta", "transferencia"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayMethod(m)}
                  className={`h-11 rounded-[3px] text-xs font-semibold uppercase ${
                    payMethod === m
                      ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                      : "border border-[var(--color-warm-stone)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {payMethod === "efectivo" ? (
              <label className="mt-4 block text-xs font-semibold uppercase">
                Efectivo recibido
                <input
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
                  inputMode="decimal"
                  placeholder="0.00"
                />
                {change != null && change >= 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-sage)]">Cambio: {money(change)}</p>
                ) : null}
              </label>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPayOpen(false)} className="h-11 px-4 text-xs font-semibold uppercase">
                Volver
              </button>
              <button type="button" onClick={confirmPay} className="h-11 bg-[var(--color-onyx-warm)] px-4 text-xs font-semibold uppercase text-[var(--color-parchment)]">
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
