"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { statusMeta, itemStatusMeta } from "@/lib/orderStatus";

/**
 * Cocina — status por ítem + status de orden (paridad Front).
 */
export function KitchenBoard({ restaurantId, initialOrders, products }) {
  const [orders, setOrders] = useState(initialOrders || []);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [queue, setQueue] = useState("pendientes");
  const supabase = useMemo(() => createClient(), []);
  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Producto";

  async function refresh() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,status,source,order_type,customer_phone,delivery_address,opened_at,needs_confirmation,public_code,table_id,order_items(product_id,qty,unit_price,notes,status),dining_tables(number,channel_type)",
      )
      .eq("restaurant_id", restaurantId)
      .in("status", ["cocina", "lista", "pendiente", "abierta", "entregada"])
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
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => refresh(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const t = setInterval(refresh, 10000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const filtered = useMemo(() => {
    return (orders || []).filter((o) => {
      if (queue === "todos") return true;
      const items = o.order_items || [];
      const active = items.filter((i) => (i.status || "pendiente") !== "cancelado");
      const allPrep = active.length > 0 && active.every((i) => i.status === "preparado");
      const anyPend = items.some((i) => (i.status || "pendiente") === "pendiente");
      if (queue === "preparados") return allPrep || o.status === "lista" || o.status === "entregada";
      return (
        anyPend ||
        o.status === "cocina" ||
        o.status === "abierta" ||
        o.status === "pendiente"
      );
    });
  }, [orders, queue]);

  async function setItemStatus(orderId, productId, status) {
    setLoading(true);
    const { error } = await supabase.rpc("set_order_item_status", {
      p_order: orderId,
      p_product: productId,
      p_status: status,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message +
          (error.message?.includes("set_order_item_status") ? " — ejecuta SQL 023 en Supabase" : ""),
      );
      return;
    }
    toast.success(
      status === "preparado"
        ? "Producto preparado"
        : status === "cancelado"
          ? "Producto cancelado"
          : "Regresado a pendiente",
    );
    await refresh();
  }

  async function markAllPreparado(orderId) {
    setLoading(true);
    const { error } = await supabase.rpc("mark_order_items_preparado", { p_order: orderId });
    setLoading(false);
    if (error) {
      // fallback: marcar orden lista
      const { error: e2 } = await supabase.from("orders").update({ status: "lista" }).eq("id", orderId);
      if (e2) return toast.error(error.message);
      toast.success("Comanda lista (fallback)");
    } else {
      toast.success("Todo preparado");
    }
    await refresh();
  }

  async function confirmWeb(id) {
    setLoading(true);
    const { error } = await supabase.rpc("confirm_web_order", { p_order: id });
    setLoading(false);
    if (error) {
      const { error: e2 } = await supabase.from("orders").update({ status: "cocina" }).eq("id", id);
      if (e2) return toast.error(error.message);
    }
    toast.success("Confirmado → cocina");
    await refresh();
  }

  async function markDelivered(id) {
    setLoading(true);
    const { error } = await supabase.from("orders").update({ status: "entregada" }).eq("id", id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Entregada");
    await refresh();
  }

  function elapsed(openedAt) {
    if (!openedAt) return "";
    const mins = Math.max(0, Math.round((Date.now() - new Date(openedAt).getTime()) / 60000));
    return `${mins} min`;
  }

  return (
    <div className="relative">
      <LoadingOverlay visible={loading} message="Actualizando cocina…" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-espresso)]">
          {live ? "En vivo" : "Sincronizando…"} · estados de producto y orden
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            { id: "pendientes", label: "Por preparar" },
            { id: "preparados", label: "Preparados" },
            { id: "todos", label: "Todos" },
          ].map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setQueue(q.id)}
              className={`h-9 rounded-[3px] px-3 text-xs font-semibold uppercase ${
                queue === q.id
                  ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                  : "bg-[var(--color-paper)]"
              }`}
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            onClick={refresh}
            className="h-9 rounded-[3px] bg-[var(--color-parchment)] px-3 text-xs font-semibold uppercase"
          >
            Actualizar
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <div className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8 text-center">
          <p className="text-2xl font-normal">Sin comandas en esta cola</p>
          <p className="mt-2 text-sm text-[var(--color-espresso)]">
            {(orders || []).length} órdenes activas en total.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((order) => {
            const meta = statusMeta(order.status);
            const isCaja = order.dining_tables?.channel_type === "caja";
            return (
              <article key={order.id} className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-2xl font-normal">
                      {order.order_type === "domicilio"
                        ? "Domicilio"
                        : isCaja
                          ? "Caja"
                          : `Mesa ${order.dining_tables?.number ?? "?"}`}
                    </h3>
                    <p className="text-xs text-[var(--color-walnut)]">
                      {(order.source || "pos").toUpperCase()}
                      {order.opened_at ? ` · ${elapsed(order.opened_at)}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-[3px] px-2 py-1 text-[10px] font-bold uppercase text-white ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>

                <ul className="my-3 space-y-2">
                  {(order.order_items || []).map((i) => {
                    const st = i.status || "pendiente";
                    const im = itemStatusMeta(st);
                    return (
                      <li key={`${order.id}-${i.product_id}`} className="text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className={im.color}>
                            <span className="font-semibold">{i.qty}×</span> {nameOf(i.product_id)}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-[var(--color-walnut)]">
                            {im.label}
                          </span>
                        </div>
                        {i.notes ? <p className="text-xs text-[var(--color-saffron-glow)]">{i.notes}</p> : null}
                        {order.status !== "pendiente" && st !== "cancelado" ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {st === "pendiente" ? (
                              <>
                                <button
                                  type="button"
                                  className="text-[10px] font-semibold uppercase text-[var(--color-sage)]"
                                  onClick={() => setItemStatus(order.id, i.product_id, "preparado")}
                                >
                                  Preparado
                                </button>
                                <button
                                  type="button"
                                  className="text-[10px] font-semibold uppercase text-[var(--color-wine)]"
                                  onClick={() => setItemStatus(order.id, i.product_id, "cancelado")}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="text-[10px] font-semibold uppercase"
                                onClick={() => setItemStatus(order.id, i.product_id, "pendiente")}
                              >
                                Regresar
                              </button>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
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
                      className="h-11 rounded-[3px] bg-[var(--color-saffron-glow)] text-xs font-semibold uppercase"
                    >
                      Confirmar → cocina
                    </button>
                  ) : order.status === "lista" || order.status === "entregada" ? (
                    <button
                      type="button"
                      onClick={() => markDelivered(order.id)}
                      className="h-11 rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]"
                    >
                      {order.status === "entregada" ? "Entregada ✓" : "Marcar entregada"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markAllPreparado(order.id)}
                      className="h-11 rounded-[3px] bg-[var(--color-sage)] text-xs font-semibold uppercase text-white"
                    >
                      Todo preparado
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {detail ? (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--color-warm-stone)] bg-[var(--color-paper)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3">
              <h2 className="text-2xl font-normal">{statusMeta(detail.status).label}</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-xs font-semibold uppercase">
                Cerrar
              </button>
            </div>
            <ul className="space-y-2 p-4">
              {(detail.order_items || []).map((i) => (
                <li key={`${detail.id}-${i.product_id}`} className={itemStatusMeta(i.status || "pendiente").color}>
                  {i.qty}× {nameOf(i.product_id)} · {itemStatusMeta(i.status || "pendiente").label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
