"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { statusMeta } from "@/lib/orderStatus";

/**
 * Cocina — paridad VistaCocina + modalCocina del Front.
 */
export function KitchenBoard({ restaurantId, initialOrders, products }) {
  const [orders, setOrders] = useState(initialOrders);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Producto";

  async function refresh() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,status,source,order_type,customer_phone,delivery_address,opened_at,needs_confirmation,public_code,order_items(product_id,qty,unit_price,notes),dining_tables(number)",
      )
      .eq("restaurant_id", restaurantId)
      .in("status", ["cocina", "lista", "pendiente"])
      .order("opened_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setOrders(data || []);
  }

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`kitchen-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          refresh();
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    const t = setInterval(refresh, 10000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function markReady(id) {
    setLoading(true);
    const { error } = await supabase.from("orders").update({ status: "lista" }).eq("id", id);
    setLoading(false);
    if (error) return toast.error(error.message);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "lista" } : o)));
    if (detail?.id === id) setDetail((d) => ({ ...d, status: "lista" }));
    toast.success("Orden lista");
  }

  async function confirmWeb(id) {
    setLoading(true);
    const { error } = await supabase.rpc("confirm_web_order", { p_order: id });
    setLoading(false);
    if (error) return toast.error(error.message);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: "cocina", needs_confirmation: false } : o,
      ),
    );
    if (detail?.id === id) {
      setDetail((d) => ({ ...d, status: "cocina", needs_confirmation: false }));
    }
    toast.success("Encargo confirmado → cocina");
  }

  async function markServed(id) {
    setLoading(true);
    const { error } = await supabase.from("orders").update({ status: "entregada" }).eq("id", id);
    setLoading(false);
    if (error) return toast.error(error.message);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setDetail(null);
    toast.success("Marcada entregada");
  }

  function elapsed(openedAt) {
    if (!openedAt) return "";
    const mins = Math.max(0, Math.round((Date.now() - new Date(openedAt).getTime()) / 60000));
    return `${mins} min`;
  }

  if (orders.length === 0) {
    return (
      <div className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8 text-center">
        <p className="text-2xl font-normal">Cocina libre</p>
        <p className="mt-2 text-[var(--color-espresso)]">
          Las comandas aparecen al enviarse desde POS, mesero, tablet, kiosko o web confirmado.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-4 h-11 rounded-[3px] bg-[var(--color-parchment)] px-5 text-xs font-semibold uppercase"
        >
          Actualizar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <LoadingOverlay visible={loading} message="Actualizando cocina…" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-espresso)]">
          {live ? "En vivo (Realtime)" : "Sincronizando…"} · respaldo cada 10 s · {orders.length} comanda(s)
        </p>
        <button
          type="button"
          onClick={refresh}
          className="h-10 rounded-[3px] bg-[var(--color-parchment)] px-4 text-xs font-semibold uppercase"
        >
          Actualizar ahora
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => {
          const meta = statusMeta(order.status);
          return (
            <article
              key={order.id}
              className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-2xl font-normal">
                    {order.order_type === "domicilio"
                      ? "Domicilio"
                      : `Mesa ${order.dining_tables?.number ?? "?"}`}
                  </h3>
                  <p className="text-xs text-[var(--color-walnut)]">
                    {(order.source || "pos").toUpperCase()}
                    {order.opened_at ? ` · ${elapsed(order.opened_at)}` : ""}
                    {order.public_code ? ` · ${order.public_code}` : ""}
                  </p>
                </div>
                <span className={`rounded-[3px] px-2 py-1 text-[10px] font-bold uppercase text-white ${meta.color}`}>
                  {meta.label}
                </span>
              </div>

              <ul className="my-3 space-y-1">
                {(order.order_items || []).slice(0, 4).map((i) => (
                  <li key={`${order.id}-${i.product_id}`} className="text-base">
                    <span className="font-semibold">{i.qty}×</span> {nameOf(i.product_id)}
                    {i.notes ? (
                      <span className="block text-xs text-[var(--color-saffron-glow)]">{i.notes}</span>
                    ) : null}
                  </li>
                ))}
                {(order.order_items || []).length > 4 ? (
                  <li className="text-xs text-[var(--color-walnut)]">
                    +{(order.order_items || []).length - 4} más…
                  </li>
                ) : null}
              </ul>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setDetail(order)}
                  className="h-10 rounded-[3px] border border-[var(--color-warm-stone)] text-xs font-semibold uppercase"
                >
                  Ver detalle
                </button>
                {order.status === "pendiente" ? (
                  <button
                    type="button"
                    onClick={() => confirmWeb(order.id)}
                    className="h-11 rounded-[3px] bg-[var(--color-saffron-glow)] text-xs font-semibold uppercase text-[var(--color-midnight-roast)]"
                  >
                    Confirmar → cocina
                  </button>
                ) : order.status === "cocina" ? (
                  <button
                    type="button"
                    onClick={() => markReady(order.id)}
                    className="h-11 rounded-[3px] bg-[var(--color-sage)] text-xs font-semibold uppercase text-white"
                  >
                    Marcar lista
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => markServed(order.id)}
                    className="h-11 rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]"
                  >
                    Marcar entregada
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal detalle — paridad modalCocina */}
      {detail ? (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--color-warm-stone)] bg-[var(--color-paper)] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3">
              <div>
                <h2 className="text-2xl font-normal">
                  {detail.order_type === "domicilio"
                    ? "Pedido a domicilio"
                    : `Mesa ${detail.dining_tables?.number ?? "?"}`}
                </h2>
                <p className="text-xs text-[var(--color-walnut)]">
                  {(detail.source || "").toUpperCase()} · {statusMeta(detail.status).label}
                  {detail.public_code ? ` · ${detail.public_code}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-xs font-semibold uppercase">
                Cerrar
              </button>
            </div>
            <div className="p-4">
              {detail.order_type === "domicilio" ? (
                <div className="mb-4 border border-[var(--color-saffron-glow)] bg-[var(--color-parchment)] p-3 text-sm">
                  <p className="font-semibold">Entrega</p>
                  <p>{detail.delivery_address || "Sin dirección"}</p>
                  {detail.customer_phone ? <p>Tel: {detail.customer_phone}</p> : null}
                </div>
              ) : null}
              <ul className="space-y-3">
                {(detail.order_items || []).map((i) => (
                  <li key={`${detail.id}-${i.product_id}`} className="border-b border-[var(--color-warm-stone)] pb-2">
                    <p className="text-lg">
                      <span className="font-semibold">{i.qty}×</span> {nameOf(i.product_id)}
                    </p>
                    {i.notes ? (
                      <p className="text-sm text-[var(--color-saffron-glow)]">Nota: {i.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-2">
                {detail.status === "pendiente" ? (
                  <button
                    type="button"
                    onClick={() => confirmWeb(detail.id)}
                    className="h-12 rounded-[3px] bg-[var(--color-saffron-glow)] text-xs font-semibold uppercase"
                  >
                    Confirmar → cocina
                  </button>
                ) : null}
                {detail.status === "cocina" ? (
                  <button
                    type="button"
                    onClick={() => markReady(detail.id)}
                    className="h-12 rounded-[3px] bg-[var(--color-sage)] text-xs font-semibold uppercase text-white"
                  >
                    Marcar lista
                  </button>
                ) : null}
                {detail.status === "lista" ? (
                  <button
                    type="button"
                    onClick={() => markServed(detail.id)}
                    className="h-12 rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]"
                  >
                    Marcar entregada
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
