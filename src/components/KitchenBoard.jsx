"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { statusMeta, itemStatusMeta, waitMeta } from "@/lib/orderStatus";
import { OrderComments } from "@/components/OrderComments";
import { confirmAsync } from "@/components/ui/confirm";

/**
 * Cocina — status por ítem + status de orden (paridad Front).
 */
export function KitchenBoard({ restaurantId, initialOrders, products }) {
  const [orders, setOrders] = useState(initialOrders || []);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [queue, setQueue] = useState("pendientes");
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const known = useRef(new Set());
  const armed = useRef(false);
  const audioRef = useRef(null);
  const supabase = useMemo(() => createClient(), []);
  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Producto";

  async function refresh() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,status,source,order_type,customer_name,customer_phone,delivery_address,opened_at,needs_confirmation,public_code,table_id,order_items(id,product_id,qty,unit_price,notes,status),dining_tables(number,channel_type)",
      )
      .eq("restaurant_id", restaurantId)
      .in("status", ["cocina", "lista", "pendiente", "abierta", "entregada"])
      .order("opened_at", { ascending: true });
    if (error) {
      toast.error(`${error.message} Revisa la conexión y toca Actualizar.`);
      return;
    }
    const list = data || [];
    const ids = new Set(list.map((order) => order.id));
    if (armed.current && soundRef.current) {
      let fresh = false;
      ids.forEach((id) => {
        if (!known.current.has(id)) fresh = true;
      });
      if (fresh) chime();
    }
    known.current = ids;
    armed.current = true;
    setOrders(list);
  }

  function chime() {
    try {
      const ctx = audioRef.current || new AudioContext();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      /* sin audio */
    }
  }

  function toggleSound() {
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundOn(next);
    try {
      localStorage.setItem("wapifood-kds-sound", next ? "1" : "0");
    } catch {
      /* storage bloqueado */
    }
    if (next) {
      const ctx = audioRef.current || new AudioContext();
      audioRef.current = ctx;
      ctx.resume?.();
      chime();
    }
  }

  useEffect(() => {
    const kick = setTimeout(() => {
      refresh();
    }, 0);
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
      clearTimeout(kick);
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
      if (queue === "domicilio") return o.order_type === "domicilio";
      if (queue === "preparados") return allPrep || o.status === "lista" || o.status === "entregada";
      return (
        anyPend ||
        o.status === "cocina" ||
        o.status === "abierta" ||
        o.status === "pendiente"
      );
    });
  }, [orders, queue]);

  async function setItemStatus(orderId, lineId, status) {
    setLoading(true);
    const { error } = await supabase.rpc("set_order_item_status", {
      p_order: orderId,
      p_line: lineId,
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

  async function rejectWeb(id) {
    const ok = await confirmAsync("No se cobra y no pasa a cocina.", {
      title: "Rechazar este domicilio",
      confirmLabel: "Rechazar",
      cancelLabel: "Volver",
    });
    if (!ok) return;
    setLoading(true);
    const { error } = await supabase.rpc("cancel_order", {
      p_order: id,
      p_reason: "Domicilio rechazado",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Domicilio rechazado");
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

  useEffect(() => {
    const kick = setTimeout(() => {
      try {
        const on = localStorage.getItem("wapifood-kds-sound") === "1";
        soundRef.current = on;
        setSoundOn(on);
      } catch {
        /* ignore */
      }
    }, 0);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative">
      <LoadingOverlay visible={loading} message="Actualizando cocina…" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base text-[var(--ink-soft)]" role="status">
          {live ? "En vivo. Un toque avanza la comanda." : "Sincronizando…"}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "pendientes", label: "Por preparar" },
            { id: "domicilio", label: "Domicilio" },
            { id: "preparados", label: "Preparados" },
            { id: "todos", label: "Todos" },
          ].map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setQueue(q.id)}
              className={`cat-chip ${queue === q.id ? "is-on" : ""}`}
              aria-pressed={queue === q.id}
            >
              {q.label}
            </button>
          ))}
          <button type="button" onClick={refresh} className="btn-ghost px-4">
            Actualizar
          </button>
          <button type="button" onClick={toggleSound} className={`px-4 ${soundOn ? "btn-primary" : "btn-ghost"}`} aria-pressed={soundOn}>
            <span className="inline-flex items-center gap-2">
              <Icon name="bell" size={20} />
              {soundOn ? "Sonido activo" : "Activar sonido"}
            </span>
          </button>
        </div>
      </div>

      {loading && !filtered.length ? (
        <div className="kds-grid" aria-hidden="true">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : null}

      {!loading && !filtered.length ? (
        <EmptyState
          icon="flame"
          title="No hay pedidos en esta lista"
          text="Cuando la caja o un mesero envíen algo, la comanda aparece aquí en grande."
        />
      ) : null}

      <div className="kds-grid">
        {filtered.map((order) => {
          const meta = statusMeta(order.status);
          const wait = waitMeta(order.opened_at, now);
          const isCaja = order.dining_tables?.channel_type === "caja";
          const title =
            order.order_type === "domicilio"
              ? "Domicilio"
              : isCaja
                ? "Caja"
                : `Mesa ${order.dining_tables?.number ?? "?"}`;
          return (
            <article key={order.id} className={`kds-card age-${wait.tone === "ok" ? "ok" : wait.tone}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-4xl">{title}</h3>
                <span className={`chip ${meta.color}`}>{meta.label}</span>
              </div>
              <p className={`chip ${wait.tone === "late" ? "chip-bad" : wait.tone === "mid" ? "chip-warn" : "chip-ok"} w-fit`}>
                <Icon name="clock" size={18} />
                {wait.label}
              </p>
              {order.order_type === "domicilio" ? (
                <p className="text-lg font-bold">
                  {order.customer_name || "Cliente"} · {order.customer_phone || "sin teléfono"}
                  <br />
                  {order.delivery_address || "Sin dirección"}
                </p>
              ) : null}
              <p className="text-base text-[var(--ink-soft)]">
                Llegó de {order.source || "caja"}
                {order.opened_at
                  ? ` · ${new Date(order.opened_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </p>
              <ul className="space-y-3">
                {(order.order_items || []).map((i) => {
                  const st = i.status || "pendiente";
                  const im = itemStatusMeta(st);
                  return (
                    <li key={`${order.id}-${i.id}`}>
                      <p className={`text-2xl font-extrabold leading-tight ${im.color}`}>
                        {i.qty}× {nameOf(i.product_id)}
                      </p>
                      <p className="text-base font-bold text-[var(--ink-soft)]">{im.label}</p>
                      {i.notes ? <p className="text-lg font-bold text-[var(--primary)]">Nota: {i.notes}</p> : null}
                      {order.status !== "pendiente" && st !== "cancelado" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {st === "pendiente" ? (
                            <>
                              <button type="button" className="btn-primary px-4" onClick={() => setItemStatus(order.id, i.id, "preparado")}>
                                Listo
                              </button>
                              <button type="button" className="btn-danger px-3" onClick={() => setItemStatus(order.id, i.id, "cancelado")}>
                                Cancelar platillo
                              </button>
                            </>
                          ) : (
                            <button type="button" className="btn-ghost px-4" onClick={() => setItemStatus(order.id, i.id, "pendiente")}>
                              Regresar
                            </button>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto grid gap-2">
                <button type="button" onClick={() => setDetail(order)} className="btn-ghost">
                  Ver detalle
                </button>
                {order.status === "pendiente" ? (
                  <>
                    <button type="button" onClick={() => confirmWeb(order.id)} className="btn-lg btn-primary">
                      Confirmar y pasar a cocina
                    </button>
                    <button type="button" onClick={() => rejectWeb(order.id)} className="btn-danger">
                      Rechazar
                    </button>
                  </>
                ) : order.status === "lista" || order.status === "entregada" ? (
                  <button type="button" onClick={() => markDelivered(order.id)} className="btn-lg btn-accent">
                    {order.status === "entregada" ? "Entregada" : "Marcar entregada"}
                  </button>
                ) : (
                  <button type="button" onClick={() => markAllPreparado(order.id)} className="btn-lg" style={{ background: "var(--sage-solid)", color: "var(--on-tone)" }}>
                    Todo listo
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {detail ? (
        <div className="sheet-back" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="kds-detail-title" className="sheet">
            <div className="sheet-handle" />
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="kds-detail-title" className="text-3xl">{statusMeta(detail.status).label}</h2>
              <button type="button" onClick={() => setDetail(null)} className="btn-ghost px-3">
                Cerrar
              </button>
            </div>
            <ul className="space-y-2 text-xl">
              {(detail.order_items || []).map((i) => (
                <li key={`${detail.id}-${i.id}`} className={itemStatusMeta(i.status || "pendiente").color}>
                  {i.qty}× {nameOf(i.product_id)} · {itemStatusMeta(i.status || "pendiente").label}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <OrderComments orderId={detail.id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
