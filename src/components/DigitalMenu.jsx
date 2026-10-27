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
}) {
  const primary = theme?.primary_color || "#c45c26";
  const secondary = theme?.secondary_color || "#1c1917";
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [openCart, setOpenCart] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const list = useMemo(
    () => products.filter((p) => !cat || p.category_id === cat),
    [products, cat],
  );
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  function add(p) {
    setCart((c) => {
      const found = c.find((x) => x.product_id === p.id);
      if (found) return c.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1 }];
    });
    setStatus("");
  }

  function changeQty(id, delta) {
    setCart((c) =>
      c.map((x) => (x.product_id === id ? { ...x, qty: x.qty + delta } : x)).filter((x) => x.qty > 0),
    );
  }

  async function submitOrder() {
    setStatus("");
    if (!tableId) return setStatus("Elige tu mesa.");
    if (cart.length === 0) return setStatus("El carrito está vacío.");
    if (requireConfirmCode && !confirmCode.trim()) {
      return setStatus("Pide el código de confirmación al mesero o caja.");
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("place_public_order", {
        p_restaurant: restaurant.id,
        p_table: tableId,
        p_items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        p_customer_name: customerName || null,
        p_notes: notes || null,
        p_confirm_code: requireConfirmCode ? confirmCode.trim() : null,
      });
      if (error) throw error;
      setCart([]);
      setConfirmCode("");
      setOpenCart(false);
      setStatus(`ok:${data}`);
    } catch (e) {
      setStatus(e.message || "No se pudo enviar el pedido");
    } finally {
      setLoading(false);
    }
  }

  const ok = status.startsWith("ok:");

  return (
    <div className="min-h-screen" style={{ background: "#f4efe6", color: secondary }}>
      <header
        className="sticky top-0 z-20 border-b border-black/5 px-4 py-4 text-white"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {restaurant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logo_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30" />
            ) : null}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">
                {mode === "kiosk" ? "Kiosko" : "Menú digital"}
              </p>
              <h1 className="text-2xl font-semibold leading-none">{restaurant.name}</h1>
              {deliveryEnabled ? (
                <p className="mt-1 text-xs opacity-80">Delivery disponible · consulta en caja</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenCart(true)}
            className="relative rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur"
          >
            Carrito
            {count > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold" style={{ color: primary }}>
                {count}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-5 pb-28">
        {ok ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <p className="font-semibold">¡Pedido enviado a cocina!</p>
            <p className="text-sm">Tu comanda ya está en preparación. Gracias.</p>
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto pb-3">
          <Chip active={!cat} onClick={() => setCat("")} color={primary}>Todos</Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} color={primary}>{c.name}</Chip>
          ))}
        </div>

        <div className="grid gap-3">
          {list.map((p) => (
            <article key={p.id} className="flex gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f4efe6]">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{p.name}</h3>
                {p.description ? <p className="line-clamp-2 text-sm text-black/50">{p.description}</p> : null}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold" style={{ color: primary }}>{money(p.price)}</span>
                  <button type="button" onClick={() => add(p)} className="h-9 rounded-full px-4 text-sm font-semibold text-white" style={{ background: primary }}>
                    Agregar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      {openCart ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Tu pedido</h2>
              <button type="button" onClick={() => setOpenCart(false)} className="text-sm font-semibold text-black/50">Cerrar</button>
            </div>
            {cart.length === 0 ? (
              <p className="mt-4 text-black/50">El carrito está vacío.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {cart.map((i) => (
                  <li key={i.product_id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{i.name}</p>
                      <p className="text-sm text-black/50">{money(i.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => changeQty(i.product_id, -1)} className="h-8 w-8 rounded-full bg-[#f4efe6] font-bold">−</button>
                      <span className="w-6 text-center font-semibold">{i.qty}</span>
                      <button type="button" onClick={() => changeQty(i.product_id, 1)} className="h-8 w-8 rounded-full bg-[#f4efe6] font-bold">+</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-4 block text-sm font-semibold">
              Mesa *
              <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-[#f4efe6] px-3 font-normal">
                <option value="">Selecciona mesa</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>Mesa {t.number}</option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-sm font-semibold">
              Nombre (opcional)
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-[#f4efe6] px-3 font-normal" />
            </label>
            <label className="mt-2 block text-sm font-semibold">
              Notas
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin cebolla, etc." className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-[#f4efe6] px-3 font-normal" />
            </label>
            {requireConfirmCode ? (
              <label className="mt-2 block text-sm font-semibold">
                Código de confirmación *
                <input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Lo da el mesero o caja"
                  className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-[#f4efe6] px-3 text-center text-xl tracking-[0.3em] font-normal"
                />
              </label>
            ) : null}
            <p className="mt-4 flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span style={{ color: primary }}>{money(total)}</span>
            </p>
            {status && !ok ? <p className="mt-2 text-sm text-red-700">{status}</p> : null}
            <button
              type="button"
              disabled={loading || cart.length === 0}
              onClick={submitOrder}
              className="mt-4 h-12 w-full rounded-full font-semibold text-white disabled:opacity-60"
              style={{ background: primary }}
            >
              {loading ? "Enviando…" : "Enviar a cocina"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children, active, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
      style={
        active
          ? { background: color, color: "#fff" }
          : { background: "#fff", color: "#1c1917", border: "1px solid rgba(0,0,0,.08)" }
      }
    >
      {children}
    </button>
  );
}
