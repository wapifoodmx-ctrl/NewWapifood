"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { toast } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

/**
 * Menú digital / kiosko — paridad Menucliente (ProductDetailModal, CartModal, etc.)
 */
export function DigitalMenu({
  restaurant,
  theme,
  products,
  categories,
  tables,
  mode = "client",
  requireConfirmCode = false,
  deliveryEnabled = false,
  orderSource = "web_menu",
  fixedTableId = null,
}) {
  const primary = theme?.primary_color || "var(--color-saffron-glow)";
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState(fixedTableId || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderType, setOrderType] = useState("mesa");
  const [confirmCode, setConfirmCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneId, setDoneId] = useState(null);

  // Modales
  const [detail, setDetail] = useState(null); // product
  const [detailQty, setDetailQty] = useState(1);
  const [detailNote, setDetailNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const list = useMemo(
    () => products.filter((p) => p.active !== false && (!cat || p.category_id === cat)),
    [products, cat],
  );
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  function openDetail(p) {
    setDetail(p);
    setDetailQty(1);
    setDetailNote("");
  }

  function addFromDetail() {
    if (!detail) return;
    setCart((c) => {
      const key = detail.id;
      const f = c.find((x) => x.product_id === key && (x.note || "") === (detailNote || ""));
      if (f) {
        return c.map((x) =>
          x === f ? { ...x, qty: x.qty + detailQty } : x,
        );
      }
      return [
        ...c,
        {
          product_id: detail.id,
          name: detail.name,
          price: Number(detail.price),
          qty: detailQty,
          note: detailNote.trim() || "",
        },
      ];
    });
    toast.success(`${detail.name} agregado`);
    setDetail(null);
  }

  function addQuick(p) {
    setCart((c) => {
      const f = c.find((x) => x.product_id === p.id && !x.note);
      if (f) return c.map((x) => (x === f ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1, note: "" }];
    });
  }

  function dec(idx) {
    setCart((c) =>
      c
        .map((x, i) => (i === idx ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0),
    );
  }

  function inc(idx) {
    setCart((c) => c.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x)));
  }

  async function submit() {
    setStatus("");
    if (!cart.length) {
      setStatus("Agrega productos al carrito.");
      toast.warning("Carrito vacío");
      return;
    }
    if (orderType === "mesa" && !tableId && !fixedTableId) {
      setStatus("Elige una mesa.");
      toast.warning("Elige una mesa");
      return;
    }
    if (orderType === "domicilio") {
      if (!deliveryEnabled) {
        setStatus("Domicilio no disponible.");
        return;
      }
      if (!address.trim() || address.trim().length < 5) {
        setStatus("Escribe la dirección de entrega.");
        return;
      }
      if (!phone.trim()) {
        setStatus("Indica un teléfono de contacto.");
        return;
      }
    }
    if (orderType === "mesa" && requireConfirmCode && !confirmCode.trim()) {
      setStatus("Pide el código de confirmación al mesero o caja.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const notesCombined = cart
      .filter((i) => i.note)
      .map((i) => `${i.name}: ${i.note}`)
      .join(" · ");

    try {
      const { data, error } = await supabase.rpc("place_public_order", {
        p_restaurant: restaurant.id,
        p_table:
          orderType === "mesa" ? tableId || fixedTableId : tableId || fixedTableId || null,
        p_items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        p_customer_name: name || null,
        p_notes: notesCombined || null,
        p_confirm_code:
          orderType === "mesa" && requireConfirmCode ? confirmCode.trim() : null,
        p_source: orderSource,
        p_order_type: orderType,
        p_customer_phone: phone || null,
        p_delivery_address: orderType === "domicilio" ? address.trim() : null,
      });
      if (error) throw error;
      setDoneId(data);
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      setStatus("ok");
      toast.success("Pedido enviado");
    } catch (e) {
      setStatus(e.message || "No se pudo enviar el pedido");
      toast.error(e.message || "No se pudo enviar el pedido");
    } finally {
      setLoading(false);
    }
  }

  if (status === "ok" && doneId) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-parchment)] px-4">
        <div className="max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-saffron-glow)]">
            {restaurant.name}
          </p>
          <h1 className="mt-2 text-3xl font-normal">¡Pedido recibido!</h1>
          <p className="mt-3 text-[var(--color-espresso)]">
            {orderType === "domicilio"
              ? "Tu encargo a domicilio quedará pendiente hasta que el restaurante lo confirme."
              : orderSource === "web_menu"
                ? "Si requiere confirmación, el local lo pasará a cocina."
                : "Tu comanda ya está en preparación."}
          </p>
          <a
            href={`/t/${doneId}`}
            className="mt-6 inline-flex h-12 items-center rounded-[3px] bg-[var(--color-onyx-warm)] px-6 text-sm font-semibold uppercase tracking-wide text-[var(--color-parchment)]"
          >
            Seguir mi pedido
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] text-[var(--color-onyx-warm)]">
      <LoadingOverlay visible={loading} message="Enviando pedido…" />

      <header className="sticky top-0 z-10 border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: primary }}>
              {mode === "kiosk" ? "Kiosko" : "Menú"}
            </p>
            <h1 className="truncate text-2xl font-normal sm:text-3xl">{restaurant.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {restaurant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logo_url} alt="" className="h-11 w-11 object-cover" />
            ) : null}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="h-11 shrink-0 rounded-[3px] px-3 text-xs font-semibold uppercase text-[var(--color-parchment)]"
              style={{ background: primary }}
            >
              Carrito ({count})
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <div className="mb-3 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCat("")}
            className={`shrink-0 rounded-[3px] px-3 py-2 text-xs font-semibold uppercase ${
              !cat ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-paper)]"
            }`}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={`shrink-0 rounded-[3px] px-3 py-2 text-xs font-semibold uppercase ${
                cat === c.id
                  ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                  : "bg-[var(--color-paper)]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((p) => (
            <div
              key={p.id}
              className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] text-left"
            >
              <button type="button" onClick={() => openDetail(p)} className="block w-full p-3 text-left">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="mb-2 h-24 w-full object-cover" />
                ) : (
                  <div className="mb-2 grid h-24 place-items-center bg-[var(--color-parchment)] text-[10px] text-[var(--color-walnut)]">
                    Sin foto
                  </div>
                )}
                <p className="font-semibold leading-tight">{p.name}</p>
                <p className="mt-1 text-sm text-[var(--color-espresso)]">{money(p.price)}</p>
              </button>
              <button
                type="button"
                onClick={() => addQuick(p)}
                className="w-full border-t border-[var(--color-warm-stone)] py-2 text-[11px] font-semibold uppercase"
              >
                + Agregar
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Modal detalle producto */}
      {detail ? (
        <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-[var(--color-warm-stone)] bg-[var(--color-paper)] shadow-2xl">
            {detail.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.image_url} alt="" className="h-48 w-full object-cover" />
            ) : null}
            <div className="p-5">
              <h2 className="text-2xl font-normal">{detail.name}</h2>
              <p className="mt-1 text-lg font-semibold">{money(detail.price)}</p>
              {detail.description ? (
                <p className="mt-2 text-sm text-[var(--color-espresso)]">{detail.description}</p>
              ) : null}
              <label className="mt-4 block text-xs font-semibold uppercase">
                Cantidad
                <div className="mt-1 flex items-center gap-3">
                  <button type="button" className="h-10 w-10 border border-[var(--color-warm-stone)] font-bold" onClick={() => setDetailQty((q) => Math.max(1, q - 1))}>−</button>
                  <span className="text-lg font-semibold">{detailQty}</span>
                  <button type="button" className="h-10 w-10 border border-[var(--color-warm-stone)] font-bold" onClick={() => setDetailQty((q) => q + 1)}>+</button>
                </div>
              </label>
              <label className="mt-3 block text-xs font-semibold uppercase">
                Nota (opcional)
                <input
                  value={detailNote}
                  onChange={(e) => setDetailNote(e.target.value)}
                  placeholder="Sin cebolla, extra salsa…"
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
                />
              </label>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setDetail(null)} className="h-12 flex-1 border border-[var(--color-warm-stone)] text-xs font-semibold uppercase">
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={addFromDetail}
                  className="h-12 flex-1 text-xs font-semibold uppercase text-[var(--color-parchment)]"
                  style={{ background: primary }}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal carrito */}
      {cartOpen ? (
        <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-[var(--color-warm-stone)] bg-[var(--color-paper)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3">
              <h2 className="text-xl font-normal">Tu carrito</h2>
              <button type="button" onClick={() => setCartOpen(false)} className="text-xs font-semibold uppercase">
                Cerrar
              </button>
            </div>
            <ul className="space-y-2 p-4">
              {cart.map((i, idx) => (
                <li key={`${i.product_id}-${idx}`} className="flex items-start justify-between gap-2 border-b border-[var(--color-warm-stone)] pb-2">
                  <div>
                    <p className="font-semibold">{i.name}</p>
                    {i.note ? <p className="text-xs text-[var(--color-saffron-glow)]">{i.note}</p> : null}
                    <p className="text-sm text-[var(--color-espresso)]">{money(i.price * i.qty)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => dec(idx)} className="h-8 w-8 border border-[var(--color-warm-stone)]">−</button>
                    <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                    <button type="button" onClick={() => inc(idx)} className="h-8 w-8 border border-[var(--color-warm-stone)]">+</button>
                  </div>
                </li>
              ))}
              {!cart.length ? <p className="text-[var(--color-walnut)]">Vacío</p> : null}
            </ul>
            <div className="border-t border-[var(--color-warm-stone)] p-4">
              <p className="mb-3 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </p>
              <button
                type="button"
                disabled={!cart.length}
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
                className="h-12 w-full text-xs font-semibold uppercase text-[var(--color-parchment)] disabled:opacity-50"
                style={{ background: primary }}
              >
                Continuar pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Checkout: mesa / domicilio / código */}
      {checkoutOpen ? (
        <div className="fixed inset-0 z-[1700] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5">
            <h2 className="text-2xl font-normal">Confirmar pedido</h2>
            <p className="text-sm text-[var(--color-espresso)]">Total {money(total)}</p>

            {deliveryEnabled && orderSource === "web_menu" ? (
              <div className="mt-3 flex gap-1">
                <button
                  type="button"
                  onClick={() => setOrderType("mesa")}
                  className={`h-10 flex-1 rounded-[3px] text-xs font-semibold uppercase ${
                    orderType === "mesa" ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-parchment)]"
                  }`}
                >
                  En mesa
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("domicilio")}
                  className={`h-10 flex-1 rounded-[3px] text-xs font-semibold uppercase ${
                    orderType === "domicilio" ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-parchment)]"
                  }`}
                >
                  Domicilio
                </button>
              </div>
            ) : null}

            {orderType === "mesa" && !fixedTableId ? (
              <label className="mt-3 block text-xs font-semibold uppercase">
                Mesa
                <select
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case"
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Mesa {t.number}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {orderType === "domicilio" ? (
              <>
                <label className="mt-3 block text-xs font-semibold uppercase">
                  Teléfono
                  <input
                    className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="mt-2 block text-xs font-semibold uppercase">
                  Dirección
                  <input
                    className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, colonia, refs."
                  />
                </label>
              </>
            ) : null}

            <label className="mt-2 block text-xs font-semibold uppercase">
              Nombre (opcional)
              <input
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            {orderType === "mesa" && requireConfirmCode ? (
              <label className="mt-2 block text-xs font-semibold uppercase">
                Código de confirmación
                <input
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 tracking-[0.2em] font-normal normal-case"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                />
              </label>
            ) : null}

            {status && status !== "ok" ? (
              <p className="mt-2 text-sm text-[var(--color-wine)]">{status}</p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setCheckoutOpen(false)} className="h-12 flex-1 border border-[var(--color-warm-stone)] text-xs font-semibold uppercase">
                Volver
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="h-12 flex-1 text-xs font-semibold uppercase text-[var(--color-parchment)] disabled:opacity-60"
                style={{ background: primary }}
              >
                {loading ? "Enviando…" : "Enviar pedido"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
