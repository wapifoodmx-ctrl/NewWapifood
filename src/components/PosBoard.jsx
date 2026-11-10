"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { extrasCharge, extrasForProduct, lineAmount } from "@/lib/extras";
import { itemStatusMeta, statusMeta } from "@/lib/orderStatus";
import { ExtrasLines, ExtrasPicker } from "@/components/ExtrasPicker";
import { isMissingRelation } from "@/lib/schema";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { EmptyState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { QuePaso } from "@/components/QuePaso";
import { askManagerPin } from "@/lib/managerPin";
import { MesaTools } from "@/components/MesaTools";
import { PAY_METHODS, cashSuggestions, categoryColor, haptic, payLabel, tableStateMeta } from "@/lib/brand";

/**
 * POS — paridad gradual con Puntodeventa (CarritoModal + ModalsPago).
 */
export function PosBoard({ restaurantId, tables: initialTables, products, categories, initialOrders, productExtras = [] }) {
  const [tables, setTables] = useState(initialTables || []);
  const [orders, setOrders] = useState(initialOrders);
  const [live, setLive] = useState(false);
  const [activeTableId, setActiveTableId] = useState(null);
  const [catFilter, setCatFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);

  // Modales (paridad Front)
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("efectivo");
  const [cashGiven, setCashGiven] = useState("");
  const [secondPay, setSecondPay] = useState("");
  const [splitPay, setSplitPay] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [folio, setFolio] = useState("");
  const [noteEdit, setNoteEdit] = useState(null); // { productId, notes }
  const [extraPick, setExtraPick] = useState(null);
  const [splitIds, setSplitIds] = useState([]);
  const [orderDiscount, setOrderDiscount] = useState({ type: "", value: "" });
  const [tip, setTip] = useState("");
  const [tipRates, setTipRates] = useState([10, 15, 20]);
  const [tipsOn, setTipsOn] = useState(true);
  const [tipMethodOverride, setTipMethodOverride] = useState(null);
  const tipMethod = tipMethodOverride ?? payMethod;
  const [guest, setGuest] = useState({ name: "", phone: "" });
  const [flashId, setFlashId] = useState(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from("restaurant_profiles")
      .select("tips_enabled,tip_rates")
      .eq("restaurant_id", restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.tips_enabled === false) setTipsOn(false);
        const rates = String(data.tip_rates || "")
          .split(",")
          .map((n) => Number(n.trim()))
          .filter((n) => n > 0 && n < 100);
        if (rates.length) setTipRates(rates);
      });
  }, [restaurantId, supabase]);

  // Realtime: órdenes + estados de mesa
  useEffect(() => {
    if (!restaurantId) return;

    async function pullOrders() {
      const { data } = await supabase
        .from("orders")
        .select(
          "id,status,source,table_id,opened_at,public_code,order_items(id,product_id,qty,unit_price,notes,status,discount_type,discount_value,stock_resolution,refunded_amount),dining_tables(number,channel_type,state)",
        )
        .eq("restaurant_id", restaurantId)
        .neq("status", "pagada")
        .neq("status", "cancelada")
        .order("opened_at", { ascending: false })
        .limit(80);
      if (data) setOrders(data);
    }

    async function pullTables() {
      const { data } = await supabase
        .from("dining_tables")
        .select("id,number,seats,channel_type,state,active,access_pin")
        .eq("restaurant_id", restaurantId)
        .order("number");
      if (data) setTables(data);
    }

    const channel = supabase
      .channel(`pos-live-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => pullOrders(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => pullOrders(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dining_tables", filter: `restaurant_id=eq.${restaurantId}` },
        () => pullTables(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, supabase]);


  const order = orders.find(
    (o) => o.table_id === activeTableId && o.status !== "pagada" && o.status !== "cancelada",
  );

  const productList = products.filter((p) => p.active !== false && (!catFilter || p.category_id === catFilter));
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const floorTables = tables.filter((t) => t.channel_type !== "kiosko" && t.active !== false && t.state !== "no_disponible");
  const allFloor = tables.filter((t) => t.channel_type !== "kiosko" && t.active !== false);
  const sortedTables = [...allFloor].sort((a, b) => {
    const rank = (t) => (t.channel_type === "caja" ? 0 : 1);
    return rank(a) - rank(b) || Number(a.number) - Number(b.number);
  });

  const subtotal = useMemo(() => {
    return (order?.order_items || []).reduce((s, i) => s + lineAmount(i), 0);
  }, [order]);

  const total = useMemo(() => {
    let t = subtotal;
    const od = order?.discount_amount != null ? Number(order.discount_amount) : 0;
    if (od > 0) t = Math.max(0, t - od);
    else if (order?.discount_type === "porcentaje") {
      t = Math.max(0, t - t * (Number(order.discount_value) || 0) / 100);
    } else if (order?.discount_type === "monto") {
      t = Math.max(0, t - (Number(order.discount_value) || 0));
    }
    t = Math.max(0, t - Number(order?.covered_amount || 0));
    if (Number(order?.portion_due) > 0) return Number(order.portion_due);
    return t;
  }, [order, subtotal]);

  const itemCount = (order?.order_items || []).reduce((s, i) => s + Number(i.qty), 0);
  const tipAmount = Math.max(0, Number(tip) || 0);

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
    setTip("");
    setTipMethodOverride(null);
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

  function chooseProduct(product) {
    const extras = extrasForProduct(productExtras, product.id);
    if (extras.length) {
      setExtraPick({ product, selected: [] });
      return;
    }
    addItem(product, []);
  }

  async function saveLineExtras(orderId, productId, selected) {
    if (!selected?.length) return;
    const rows = selected.map((extra) => ({
      order_id: orderId,
      product_id: productId,
      ingredient_id: extra.ingredient_id,
      qty: Number(extra.qty) || 1,
      extra_price: Number(extra.extra_price) || 0,
    }));
    const { error } = await supabase.from("order_item_extras").upsert(rows, {
      onConflict: "order_id,product_id,ingredient_id",
    });
    if (error && !isMissingRelation(error)) {
      toast.error(error.message);
    }
  }

  async function addItem(product, selected = []) {
    if (!order) {
      toast.warning("Elige una mesa primero");
      return;
    }
    setLoading(true);
    const note = null; // notas se agregan después; línea base sin nota
    const line = (order.order_items || []).find((i) => i.product_id === product.id && (i.notes || null) === note);
    if (line) {
      await supabase
        .from("order_items")
        .update({ qty: Number(line.qty) + 1 })
        .eq("id", line.id);
    } else {
      const { error } = await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: product.id,
        qty: 1,
        unit_price: product.price,
        notes: null,
      });
      if (error) {
        setLoading(false);
        toast.error(error.message);
        return;
      }
    }
    await saveLineExtras(order.id, product.id, selected);
    await refresh();
    setLoading(false);
    setFlashId(product.id);
    haptic();
    window.setTimeout(() => setFlashId((id) => (id === product.id ? null : id)), 280);
    toast.info(`${product.name} agregado`);
  }

  async function restoreLine(snapshot) {
    const orderId = snapshot.order_id || order?.id;
    if (!orderId) return;
    setLoading(true);
    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      product_id: snapshot.product_id,
      qty: snapshot.qty,
      unit_price: snapshot.unit_price,
      notes: snapshot.notes || null,
      status: snapshot.status || "pendiente",
    });
    if (!error && snapshot.extras?.length) {
      await supabase.from("order_item_extras").upsert(
        snapshot.extras.map((extra) => ({
          order_id: orderId,
          product_id: snapshot.product_id,
          ingredient_id: extra.ingredient_id,
          qty: extra.qty,
          extra_price: extra.extra_price,
        })),
        { onConflict: "order_id,product_id,ingredient_id" },
      );
    }
    setLoading(false);
    if (error) {
      toast.error(error.message || "No se pudo deshacer. Agrégalo de nuevo.");
      return;
    }
    await refresh();
    toast.success("Regresamos el platillo");
  }

  async function changeQty(lineId, delta) {
    if (!order) return;
    const line = (order.order_items || []).find((i) => i.id === lineId);
    if (!line) return;
    const next = Number(line.qty) + delta;
    setLoading(true);
    if (next <= 0) {
      const extras = await supabase
        .from("order_item_extras")
        .select("ingredient_id,qty,extra_price")
        .eq("order_id", order.id)
        .eq("product_id", line.product_id);
      await supabase
        .from("order_items")
        .delete()
        .eq("id", lineId);
      const snapshot = { ...line, extras: extras.error ? [] : extras.data || [] };
      const name = productMap.get(line.product_id)?.name || "Platillo";
      toast.warning(`Quitamos ${name}`, {
        action: {
          label: "Deshacer",
          onClick: () => restoreLine(snapshot),
        },
      });
    } else {
      await supabase
        .from("order_items")
        .update({ qty: next })
        .eq("id", lineId);
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
      .eq("id", noteEdit.lineId);
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
    const { error } = await supabase.rpc("send_order_to_kitchen", { p_order: order.id });
    setLoading(false);
    if (error) {
      // fallback si aún no corre SQL 023
      const { error: e2 } = await supabase.from("orders").update({ status: "cocina" }).eq("id", order.id);
      if (e2) return toast.error(error.message);
    }
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
    const pin = askManagerPin();
    if (pin == null) return;
    setLoading(true);
    const { error } = await supabase.rpc("cancel_order", {
      p_order: order.id,
      p_reason: "Cancelada en punto de venta",
      p_pin: pin || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setActiveTableId(null);
    setCartOpen(false);
    await refresh();
    toast.success("Cuenta cancelada");
  }

  async function applyOrderDiscount() {
    if (!order) return;
    const type = orderDiscount.type || null;
    const value = Number(orderDiscount.value || 0);
    const pin = value > 0 ? askManagerPin() : "";
    if (pin == null) return;
    setLoading(true);
    const { error } = await supabase.rpc("set_order_discount", {
      p_order: order.id,
      p_type: type || null,
      p_value: value,
      p_pin: pin || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message + (error.message?.includes("set_order_discount") ? " — ¿SQL 024?" : ""));
    await refresh();
    toast.success("Descuento aplicado");
  }

  async function applyLineDiscount(productId, type, value) {
    if (!order) return;
    const numeric = Number(value || 0);
    const pin = numeric > 0 ? askManagerPin() : "";
    if (pin == null) return;
    setLoading(true);
    const rpc = await supabase.rpc("set_item_discount", {
      p_order: order.id,
      p_product: productId,
      p_type: type || null,
      p_value: numeric,
      p_pin: pin || null,
    });
    if (rpc.error && /set_item_discount|schema cache|PGRST202/i.test(rpc.error.message)) {
      const { error } = await supabase
        .from("order_items")
        .update({
          discount_type: type || null,
          discount_value: type ? numeric : 0,
        })
        .eq("order_id", order.id)
        .eq("product_id", productId);
      setLoading(false);
      if (error) return toast.error(error.message);
    } else if (rpc.error) {
      setLoading(false);
      return toast.error(rpc.error.message);
    } else {
      setLoading(false);
    }
    await refresh();
  }

  async function saveGuest() {
    if (!order) return;
    const { error } = await supabase
      .from("orders")
      .update({
        customer_name: guest.name.trim() || null,
        customer_phone: guest.phone.trim() || null,
      })
      .eq("id", order.id);
    if (error) return toast.error(error.message);
    toast.success("Cliente anotado en la cuenta");
    await refresh();
  }

  const chargeItems = splitIds.length
    ? (order?.order_items || []).filter((i) => splitIds.includes(i.id))
    : null;
  const chargeTotal = chargeItems ? chargeItems.reduce((s, i) => s + lineAmount(i), 0) : total;

  function openPay(onlyMarked = false) {
    if (!order) return;
    if (onlyMarked) {
      if (!splitIds.length) {
        toast.warning("Marca los productos que se cobran aparte");
        return;
      }
    } else if (!(order.order_items || []).length) {
      toast.warning("No hay productos que cobrar");
      return;
    }
    if (!onlyMarked) setSplitIds([]);
    setPayMethod("efectivo");
    setCashGiven("");
    setSecondPay("");
    setSplitPay(false);
    setShowTip(false);
    setFolio("");
    setPayOpen(true);
    setGuest({
      name: order.customer_name || "",
      phone: order.customer_phone || "",
    });
  }

  async function moveMarkedLines() {
    const lines = (order.order_items || []).filter((i) => splitIds.includes(i.id));
    const { data: created, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: order.table_id,
        status: "entregada",
        source: "pos",
      })
      .select("id")
      .single();
    if (error) throw error;
    for (const line of lines) {
      const { error: insErr } = await supabase.from("order_items").insert({
        order_id: created.id,
        product_id: line.product_id,
        qty: line.qty,
        unit_price: line.unit_price,
        notes: line.notes || null,
        status: line.status || "pendiente",
        discount_type: line.discount_type || null,
        discount_value: line.discount_value || 0,
      });
      if (insErr) throw insErr;
      const extras = await supabase
        .from("order_item_extras")
        .select("ingredient_id,qty,extra_price")
        .eq("order_id", order.id)
        .eq("product_id", line.product_id);
      if (!extras.error && extras.data?.length) {
        await supabase.from("order_item_extras").insert(
          extras.data.map((x) => ({
            order_id: created.id,
            product_id: line.product_id,
            ingredient_id: x.ingredient_id,
            qty: x.qty,
            extra_price: x.extra_price,
          })),
        );
      }
      await supabase.from("order_items").delete().eq("order_id", order.id).eq("product_id", line.product_id);
    }
    return { id: created.id, emptied: lines.length === (order.order_items || []).length };
  }

  async function confirmPay() {
    if (!order) return;
    const due = Math.round((chargeTotal + tipAmount) * 100) / 100;
    if (payMethod === "efectivo") {
      const given = Number(cashGiven);
      if (!Number.isNaN(given) && given > 0 && given + 0.001 < due) {
        toast.error("El efectivo recibido es menor al total");
        return;
      }
    }
    setLoading(true);
    let targetId = order.id;
    let emptied = false;
    try {
      if (splitIds.length) {
        const moved = await moveMarkedLines();
        targetId = moved.id;
        emptied = moved.emptied;
      }
    } catch (e) {
      setLoading(false);
      toast.error(e.message || "No se pudo separar la cuenta");
      return;
    }
    const snapshot = {
      items: (splitIds.length ? chargeItems : order.order_items || []).map((i) => ({
        name: productMap.get(i.product_id)?.name || "Producto",
        qty: i.qty,
        line: lineAmount(i),
        notes: i.notes,
      })),
      total: due,
      food: chargeTotal,
      tip: tipAmount,
      tipMethod: tipAmount > 0 ? tipMethod : null,
      method: payMethod,
      table: tableMap.get(order.table_id)?.number,
      cashGiven: payMethod === "efectivo" ? Number(cashGiven) || null : null,
      change: payMethod === "efectivo" && Number(cashGiven) > 0 ? Math.round((Number(cashGiven) - due) * 100) / 100 : null,
    };
    let { error } = await supabase.rpc("close_order", {
      p_order: targetId,
      p_method: payMethod,
      p_cash: payMethod === "efectivo" && cashGiven !== "" ? Number(cashGiven) : null,
      p_tip: tipAmount,
      p_tip_method: tipAmount > 0 ? tipMethod : null,
    });
    if (error && /close_order|schema cache|PGRST202|could not find/i.test(error.message)) {
      ({ error } = await supabase.rpc("close_order", {
        p_order: targetId,
        p_method: payMethod,
      }));
    }
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const second = splitPay ? Number(secondPay) || 0 : 0;
    const payments = [];
    if (second > 0 && second < due) {
      payments.push({ method: payMethod, amount: Math.round((due - second) * 100) / 100, folio: folio || null });
      payments.push({ method: payMethod === "efectivo" ? "tarjeta" : "efectivo", amount: second, folio: folio || null });
    } else {
      payments.push({ method: payMethod, amount: due, folio: folio || null });
    }
    await supabase.rpc("attach_ticket_payments", { p_order: targetId, p_payments: payments });
    if (emptied) {
      const pin = askManagerPin();
      if (pin != null) {
        await supabase.rpc("cancel_order", { p_order: order.id, p_reason: "Cuenta separada y cobrada", p_pin: pin || null });
      }
    }
    setLastTicket(snapshot);
    setPayOpen(false);
    setSplitIds([]);
    setTip("");
    setTipMethodOverride(null);
    if (!splitIds.length || emptied) {
      setCartOpen(false);
      setActiveTableId(null);
    }
    await refresh();
    toast.success(splitIds.length ? `Parte cobrada con ${payLabel(payMethod)}` : `Cobrado con ${payLabel(payMethod)}`);
  }

  const dueNow = Math.round((chargeTotal + tipAmount) * 100) / 100;
  const change =
    payMethod === "efectivo" && Number(cashGiven) > 0 ? Math.round((Number(cashGiven) - dueNow) * 100) / 100 : null;
  const suggestions = cashSuggestions(dueNow);
  const activeTable = tableMap.get(activeTableId);
  const catName = (id) => categories.find((c) => c.id === id)?.name || "Platillo";

  const summary = (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl">Cuenta</h2>
          <p className="text-base text-[var(--ink-soft)]">
            {activeTable
              ? activeTable.channel_type === "caja"
                ? "Caja"
                : `Mesa ${activeTable.number}`
              : "Elige una mesa"}
            {order ? ` · ${statusMeta(order.status).label}` : ""}
          </p>
        </div>
        <button type="button" className="btn-ghost px-3 lg:hidden" onClick={() => setCartOpen(false)}>
          Cerrar
        </button>
      </div>
      <ul className="space-y-2">
        {(order?.order_items || []).map((i) => {
          const p = productMap.get(i.product_id);
          return (
            <li key={i.id || `${i.order_id}-${i.product_id}`} className="line">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-lg font-extrabold ${itemStatusMeta(i.status).color}`}>{p?.name || "Producto"}</p>
                  <p className="text-sm font-bold text-[var(--ink-soft)]">{itemStatusMeta(i.status).label}</p>
                  {i.notes ? <p className="text-base text-[var(--primary)]">{i.notes}</p> : null}
                  <ExtrasLines extras={i.order_item_extras} />
                </div>
                <span className="text-lg font-extrabold">{money(lineAmount(i))}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex min-h-12 items-center gap-2 text-base font-bold">
                  <input
                    type="checkbox"
                    checked={splitIds.includes(i.id)}
                    onChange={() =>
                      setSplitIds((ids) =>
                        ids.includes(i.id) ? ids.filter((id) => id !== i.id) : [...ids, i.id],
                      )
                    }
                  />
                  Separar
                </label>
                <div className="qty">
                  <button type="button" onClick={() => changeQty(i.id, -1)} aria-label={`Quitar uno de ${p?.name || "producto"}`}>
                    −
                  </button>
                  <span>{i.qty}</span>
                  <button type="button" onClick={() => changeQty(i.id, 1)} aria-label={`Agregar uno de ${p?.name || "producto"}`}>
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-ghost px-3"
                  onClick={() => setNoteEdit({ lineId: i.id, productId: i.product_id, notes: i.notes || "" })}
                >
                  Nota
                </button>
                <label className="sr-only" htmlFor={`line-discount-${i.product_id}`}>Descuento del platillo</label>
                <select
                  id={`line-discount-${i.product_id}`}
                  value={i.discount_type || ""}
                  onChange={(e) => applyLineDiscount(i.product_id, e.target.value, i.discount_value || 0)}
                >
                  <option value="">Sin desc.</option>
                  <option value="porcentaje">%</option>
                  <option value="monto">$</option>
                </select>
                {i.discount_type ? (
                  <input
                    aria-label={`Valor del descuento de ${p?.name || "platillo"}`}
                    className="w-16"
                    inputMode="decimal"
                    defaultValue={i.discount_value || ""}
                    key={`${i.product_id}-${i.discount_type}-${i.discount_value}`}
                    onBlur={(e) => applyLineDiscount(i.product_id, i.discount_type, e.target.value)}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {!(order?.order_items || []).length ? (
        <EmptyState icon="cart" title="La cuenta está vacía" text="Toca un platillo para agregarlo. Un toque suma uno." />
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-bold">
          Cliente
          <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} placeholder="Nombre" />
        </label>
        <label className="text-sm font-bold">
          Teléfono
          <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} inputMode="tel" placeholder="10 dígitos" />
        </label>
        <button type="button" className="btn-ghost mt-5" onClick={saveGuest}>Anotar</button>
      </div>
      <div className="mt-4 grid grid-cols-[1.2fr_0.8fr_auto] gap-2">
        <label className="sr-only" htmlFor="pos-discount-type">Tipo de descuento</label>
        <select
          id="pos-discount-type"
          value={orderDiscount.type}
          onChange={(e) => setOrderDiscount((d) => ({ ...d, type: e.target.value }))}
        >
          <option value="">Sin descuento</option>
          <option value="porcentaje">Porcentaje</option>
          <option value="monto">Pesos</option>
        </select>
        <label className="sr-only" htmlFor="pos-discount-value">Cantidad del descuento</label>
        <input
          id="pos-discount-value"
          value={orderDiscount.value}
          onChange={(e) => setOrderDiscount((d) => ({ ...d, value: e.target.value.replace(/[^\d.]/g, "") }))}
          placeholder="0"
          inputMode="decimal"
        />
        <button type="button" className="btn-ghost px-3" onClick={applyOrderDiscount}>
          Aplicar
        </button>
      </div>
      {subtotal !== total ? (
        <p className="mt-3 flex justify-between text-base text-[var(--ink-soft)]">
          <span>Subtotal</span><span>{money(subtotal)}</span>
        </p>
      ) : null}
      <p className="mt-1 flex items-end justify-between">
        <span className="text-lg font-bold">Total</span>
        <span className="text-3xl font-extrabold">{money(total)}</span>
      </p>
      <div className="mt-3 grid gap-2">
        <button type="button" className="btn-lg btn-accent" onClick={sendKitchen}>
          Enviar a cocina
        </button>
        <button type="button" className="btn-lg btn-primary" onClick={() => openPay(false)}>
          Cobrar {money(total)}
        </button>
        <button type="button" className="btn-ghost" onClick={() => openPay(true)}>
          Cobrar solo lo marcado
        </button>
        <QuePaso order={order} onDone={refresh} />
        <MesaTools order={order} tables={floorTables} orders={orders} marked={chargeItems || []} onDone={refresh} />
        <button type="button" className="btn-danger" onClick={cancelOrder}>
          Cancelar cuenta
        </button>
      </div>
    </div>
  );

  return (
    <div className="pos-shell relative">
      <p className="mb-3 text-base font-bold text-[var(--ink-soft)]" role="status">
        {live ? "En vivo. Las mesas se actualizan solas." : "Conectando… si tarda, revisa tu internet."}
      </p>
      <LoadingOverlay visible={loading} message="Guardando la cuenta…" />

      <div className="pos-layout">
        <aside aria-label="Mesas">
          <h2 className="mb-2 text-xl">Mesas</h2>
          <div className="pos-tables-grid">
            {sortedTables.map((t) => {
              const liveOrder = orders.find(
                (o) => o.table_id === t.id && o.status !== "pagada" && o.status !== "cancelada",
              );
              const meta = tableStateMeta(t.state, Boolean(liveOrder));
              const active = activeTableId === t.id;
              const name = t.channel_type === "caja" ? "Caja" : `Mesa ${t.number}`;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => (t.state === "no_disponible" ? toast.warning("Esa mesa está marcada como no disponible.") : openTable(t.id))}
                  className={`table-tile tone-${meta.tone} ${active ? "is-on" : ""}`}
                >
                  <Icon name={meta.icon} size={22} />
                  <span className="table-tile-name">{name}</span>
                  <span className="table-tile-state">
                    {meta.label}
                    {liveOrder ? ` · ${statusMeta(liveOrder.status).label}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {!sortedTables.length ? (
            <EmptyState icon="table" title="Aún no hay mesas" text="Crea la caja o una mesa. Sin eso no se puede vender." action={<a className="btn-primary mt-2 inline-flex items-center px-4 no-underline" href="/mesas">Crear mesa</a>} />
          ) : null}
        </aside>

        <section aria-label="Platillos">
          {!activeTableId ? (
            <EmptyState
              icon="table"
              title="Elige una mesa para empezar"
              text="Toca Caja o una mesa libre. Después, un toque en el platillo lo agrega."
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-3xl">
                    {activeTable?.channel_type === "caja" ? "Caja" : `Mesa ${activeTable?.number}`}
                  </h2>
                  <p className="text-base text-[var(--ink-soft)]">
                    {order ? statusMeta(order.status).label : "Sin cuenta"} · {itemCount} {itemCount === 1 ? "platillo" : "platillos"}
                  </p>
                </div>
              </div>
              <div className="cat-row" role="tablist" aria-label="Categorías">
                <button type="button" className={`cat-chip ${!catFilter ? "is-on" : ""}`} onClick={() => setCatFilter("")}>
                  Todos
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cat-chip ${catFilter === c.id ? "is-on" : ""}`}
                    onClick={() => setCatFilter(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="pos-grid mt-3">
                {productList.map((p) => {
                  const color = categoryColor(p.category_id || p.name);
                  const hasExtras = extrasForProduct(productExtras, p.id).length > 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => chooseProduct(p)}
                      className={`pos-tile ${flashId === p.id ? "tap-flash" : ""}`}
                    >
                      <span className="pos-tile-media" style={{ background: color }}>
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt="" />
                        ) : (
                          <span>{(p.name || "?").slice(0, 1).toUpperCase()}</span>
                        )}
                      </span>
                      <span className="pos-tile-body">
                        <span className="pos-tile-cat" style={{ color }}>{catName(p.category_id)}</span>
                        <span className="pos-tile-name">{p.name}</span>
                        <span className="pos-tile-price">{money(p.price)}</span>
                        {hasExtras ? <span className="pos-tile-extra">Con adicionales</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!productList.length ? (
                <EmptyState icon="dish" title="No hay platillos en esta lista" text="Prueba otra categoría o agrega platillos en la carta." action={<a className="btn-primary mt-2 inline-flex items-center px-4 no-underline" href="/carta">Ir a platillos</a>} />
              ) : null}
            </>
          )}

          {lastTicket ? (
            <div className="card mt-4 p-4" role="status">
              <p className="text-base font-bold text-[var(--primary)]">Último ticket</p>
              <p className="text-xl font-extrabold">
                Mesa {lastTicket.table} · {PAY_METHODS.find((m) => m.id === lastTicket.method)?.label || lastTicket.method}
              </p>
              <ul className="mt-2 space-y-1 text-base">
                {lastTicket.items.map((i, idx) => (
                  <li key={idx}>
                    {i.qty} × {i.name}
                    {i.notes ? ` (${i.notes})` : ""} — {money(i.line)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-2xl font-extrabold">{money(lastTicket.total)}</p>
              {lastTicket.tip ? <p className="text-base">Incluye propina {money(lastTicket.tip)}</p> : null}
              {lastTicket.cashGiven ? (
                <p className="text-base text-[var(--ink-soft)]">
                  Recibiste {money(lastTicket.cashGiven)}. Cambio {money(lastTicket.change ?? Math.max(0, lastTicket.cashGiven - lastTicket.total))}.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside id="pos-cuenta" className={`pos-summary ${cartOpen ? "open" : ""}`} aria-label="Resumen de la cuenta">
          {summary}
        </aside>
      </div>

      {activeTableId && !cartOpen ? (
        <div className="pos-dock">
          <button type="button" className="btn-ghost flex-1" onClick={() => setCartOpen(true)}>
            Cuenta · {itemCount}
          </button>
          <button type="button" className="btn-lg btn-primary flex-[1.4]" onClick={() => openPay(false)}>
            Cobrar {money(total)}
          </button>
        </div>
      ) : null}

      {cartOpen ? (
        <button type="button" className="sheet-back lg:hidden" aria-label="Cerrar cuenta" onClick={() => setCartOpen(false)} />
      ) : null}

      {noteEdit ? (
        <div className="sheet-back" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="pos-note-title" className="sheet">
            <div className="sheet-handle" />
            <h2 id="pos-note-title" className="text-2xl">Nota del platillo</h2>
            <p className="text-base text-[var(--ink-soft)]">Por ejemplo: sin cebolla, término medio.</p>
            <textarea
              value={noteEdit.notes}
              onChange={(e) => setNoteEdit((n) => ({ ...n, notes: e.target.value }))}
              rows={3}
              className="mt-3 w-full"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setNoteEdit(null)} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button type="button" onClick={saveNote} className="btn-primary flex-1">
                Guardar nota
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {extraPick ? (
        <div className="sheet-back" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="pos-extras-title" className="sheet">
            <div className="sheet-handle" />
            <h2 id="pos-extras-title" className="text-2xl">{extraPick.product.name}</h2>
            <p className="text-lg font-extrabold">
              {money(Number(extraPick.product.price) + extrasCharge(extraPick.selected))}
            </p>
            <ExtrasPicker
              extras={extrasForProduct(productExtras, extraPick.product.id)}
              selected={extraPick.selected}
              onToggle={(extra) =>
                setExtraPick((pick) => {
                  if (!pick) return pick;
                  const has = pick.selected.some((item) => item.ingredient_id === extra.ingredient_id);
                  return {
                    ...pick,
                    selected: has
                      ? pick.selected.filter((item) => item.ingredient_id !== extra.ingredient_id)
                      : [...pick.selected, extra],
                  };
                })
              }
            />
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setExtraPick(null)} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const pick = extraPick;
                  setExtraPick(null);
                  addItem(pick.product, pick.selected);
                }}
                className="btn-lg btn-primary flex-1"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payOpen ? (
        <div className="sheet-back" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="pos-pay-title" className="sheet">
            <div className="sheet-handle" />
            <h2 id="pos-pay-title" className="text-2xl">Cobrar</h2>
            <p className="text-4xl font-extrabold">{money(dueNow)}</p>
            <p className="text-base text-[var(--ink-soft)]">
              Alimentos {money(chargeTotal)}
              {tipAmount ? ` · propina ${money(tipAmount)}` : ""}
            </p>
            {splitIds.length ? <p className="text-base text-[var(--ink-soft)]">Solo los platillos marcados para separar. El descuento de toda la cuenta no se parte.</p> : null}
            <label className="mt-3 block text-base font-bold">
              Folio o comentario
              <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] px-3" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Opcional. Referencia, vale o nota" />
            </label>
            <button type="button" className="btn-ghost mt-3" onClick={() => setSplitPay((on) => !on)}>
              {splitPay ? "Ocultar otra forma de pago" : "Otra forma de pago, si la cuenta se parte"}
            </button>
            {splitPay ? (
              <label className="mt-2 block text-base font-bold">
                Cuánto va en la otra forma
                <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] px-3" inputMode="decimal" value={secondPay} onChange={(e) => setSecondPay(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
              </label>
            ) : null}
            {tipsOn ? (
              <button type="button" className="btn-ghost mt-2" onClick={() => setShowTip((on) => !on)}>
                {showTip || tipAmount ? "Ocultar propina" : "Agregar propina"}
              </button>
            ) : null}
            {tipsOn && (showTip || tipAmount) ? (
            <>
            <div className="mt-3 flex flex-wrap gap-2">
              {tipRates.map((rate) => (
                <button key={rate} type="button" className="h-12 rounded-[14px] border border-[var(--border)] px-3 font-bold" onClick={() => setTip(String(Math.round(chargeTotal * rate) / 100))}>
                  {rate}%
                </button>
              ))}
              <button type="button" className="h-12 rounded-[14px] border border-[var(--border)] px-3" onClick={() => setTip("")}>Sin propina</button>
            </div>
            <label className="mt-3 block text-base font-bold" htmlFor="pos-tip">
              Propina (no cambia el precio del platillo)
              <input
                id="pos-tip"
                value={tip}
                onChange={(e) => setTip(e.target.value.replace(/[^\d.]/g, ""))}
                className="mt-1 w-full"
                inputMode="decimal"
                placeholder="0.00"
              />
            </label>
            </>
            ) : null}
            {tipAmount > 0 ? (
              <div className="mt-2 flex gap-2 text-sm">
                <span className="self-center text-[var(--color-muted)]">Propina en:</span>
                {["efectivo", "tarjeta", "transferencia"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTipMethodOverride(m)}
                    className={`rounded-full px-3 py-1 font-semibold ${
                      tipMethod === m
                        ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                        : "border border-[var(--color-line)]"
                    }`}
                  >
                    {payLabel(m)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {PAY_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayMethod(m.id)}
                  className={`pay-choice ${payMethod === m.id ? "is-on" : ""}`}
                  aria-pressed={payMethod === m.id}
                >
                  <Icon name={m.id === "efectivo" ? "cash" : m.id === "tarjeta" ? "card" : "qr"} size={22} />
                  <span className="mt-1 block font-extrabold">{m.label}</span>
                  <small>{m.hint}</small>
                </button>
              ))}
            </div>
            {payMethod === "efectivo" ? (
              <div className="mt-4">
                <label className="block text-base font-bold" htmlFor="cash-given">
                  Efectivo que te dan
                  <input
                    id="cash-given"
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value.replace(/[^\d.]/g, ""))}
                    className="mt-1 w-full text-2xl font-extrabold"
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((n) => (
                    <button key={n} type="button" className="btn-ghost px-3" onClick={() => setCashGiven(String(n))}>
                      {money(n)}
                    </button>
                  ))}
                </div>
                {change != null && change >= 0 ? (
                  <p className="mt-3 text-2xl font-extrabold text-[var(--sage)]" role="status">Cambio {money(change)}</p>
                ) : null}
                {change != null && change < 0 ? (
                  <p className="mt-3 text-base font-bold text-[var(--wine)]" role="alert">Falta dinero. El efectivo no alcanza el total.</p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={confirmPay} className="btn-lg btn-primary">
                Confirmar cobro
              </button>
              <button type="button" onClick={() => setPayOpen(false)} className="btn-ghost">
                Volver
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
