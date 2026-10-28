"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

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

  const list = useMemo(
    () => products.filter((p) => !cat || p.category_id === cat),
    [products, cat],
  );
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function add(p) {
    setCart((c) => {
      const f = c.find((x) => x.product_id === p.id);
      if (f) return c.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1 }];
    });
  }

  function dec(id) {
    setCart((c) =>
      c
        .map((x) => (x.product_id === id ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0),
    );
  }

  async function submit() {
    setStatus("");
    if (!cart.length) return setStatus("Agrega productos al carrito.");
    if (orderType === "mesa" && !tableId && !fixedTableId) {
      return setStatus("Elige una mesa.");
    }
    if (orderType === "domicilio") {
      if (!deliveryEnabled) return setStatus("Domicilio no disponible.");
      if (!address.trim() || address.trim().length < 5) {
        return setStatus("Escribe la dirección de entrega.");
      }
      if (!phone.trim()) return setStatus("Indica un teléfono de contacto.");
    }
    if (orderType === "mesa" && requireConfirmCode && !confirmCode.trim()) {
      return setStatus("Pide el código de confirmación al mesero o caja.");
    }

    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("place_public_order", {
        p_restaurant: restaurant.id,
        p_table: orderType === "mesa" ? tableId || fixedTableId : tableId || fixedTableId || null,
        p_items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        p_customer_name: name || null,
        p_notes: null,
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
      setStatus("ok");
    } catch (e) {
      setStatus(e.message || "No se pudo enviar el pedido");
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
      <header className="border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: primary }}>
              {mode === "kiosk" ? "Kiosko" : "Menú"}
            </p>
            <h1 className="text-3xl font-normal">{restaurant.name}</h1>
          </div>
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logo_url} alt="" className="h-12 w-12 object-cover" />
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-6 pb-40 lg:grid-cols-[1fr_280px]">
        <section>
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
                  cat === c.id ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-paper)]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-3 text-left"
              >
                <p className="font-semibold leading-tight">{p.name}</p>
                <p className="mt-1 text-sm text-[var(--color-espresso)]">{money(p.price)}</p>
              </button>
            ))}
          </div>
        </section>

        <aside className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          <h2 className="text-xl font-normal">Tu pedido</h2>
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
            {cart.map((i) => (
              <li key={i.product_id} className="flex items-center justify-between gap-2">
                <span>
                  {i.qty} × {i.name}
                </span>
                <button type="button" onClick={() => dec(i.product_id)} className="text-xs font-semibold">
                  −
                </button>
              </li>
            ))}
            {!cart.length ? <li className="text-[var(--color-walnut)]">Vacío</li> : null}
          </ul>
          <p className="mt-3 text-lg font-semibold">{money(total)}</p>

          {deliveryEnabled && orderSource === "web_menu" ? (
            <div className="mt-3 flex gap-1">
              <button
                type="button"
                onClick={() => setOrderType("mesa")}
                className={`h-9 flex-1 rounded-[3px] text-xs font-semibold uppercase ${
                  orderType === "mesa" ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-parchment)]"
                }`}
              >
                En mesa
              </button>
              <button
                type="button"
                onClick={() => setOrderType("domicilio")}
                className={`h-9 flex-1 rounded-[3px] text-xs font-semibold uppercase ${
                  orderType === "domicilio" ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-parchment)]"
                }`}
              >
                Domicilio
              </button>
            </div>
          ) : null}

          {orderType === "mesa" && !fixedTableId ? (
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
              Mesa
              <select
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
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
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
                Teléfono
                <input
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
                Dirección
                <input
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, colonia, refs."
                />
              </label>
            </>
          ) : null}

          <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
            Nombre (opcional)
            <input
              className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {orderType === "mesa" && requireConfirmCode ? (
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
              Código de confirmación
              <input
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
              />
            </label>
          ) : null}

          {status && status !== "ok" ? (
            <p className="mt-2 text-sm text-[var(--color-wine)]">{status}</p>
          ) : null}

          <button
            type="button"
            disabled={loading}
            onClick={submit}
            className="mt-4 h-12 w-full rounded-[3px] text-sm font-semibold uppercase tracking-wide text-[var(--color-parchment)]"
            style={{ background: primary }}
          >
            {loading ? "Enviando…" : "Enviar pedido"}
          </button>
        </aside>
      </main>
    </div>
  );
}
