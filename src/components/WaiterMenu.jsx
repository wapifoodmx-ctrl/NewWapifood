"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

export function WaiterMenu({ restaurantId, restaurantName, products, categories, tables }) {
  const [waiter, setWaiter] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const allowedTables = useMemo(() => {
    if (!waiter) return [];
    const ids = waiter.table_ids || [];
    if (!ids.length) return tables; // sin asignación = todas
    return tables.filter((t) => ids.includes(t.id));
  }, [waiter, tables]);

  const list = products.filter((p) => !cat || p.category_id === cat);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  async function login(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error: err } = await supabase.rpc("waiter_login", {
        p_restaurant: restaurantId,
        p_code: code,
      });
      if (err) throw err;
      setWaiter(data);
      setCode("");
    } catch (e2) {
      setError(e2.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  function add(p) {
    setCart((c) => {
      const f = c.find((x) => x.product_id === p.id);
      if (f) return c.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1 }];
    });
  }

  async function send() {
    setMsg("");
    if (!tableId) return setMsg("Elige mesa");
    if (!cart.length) return setMsg("Carrito vacío");
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("place_public_order", {
        p_restaurant: restaurantId,
        p_table: tableId,
        p_items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        p_customer_name: waiter?.name || "Mesero",
        p_notes: null,
        p_confirm_code: null,
      });
      if (error) throw error;
      setCart([]);
      setMsg("Comanda enviada a cocina");
    } catch (e) {
      setMsg(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!waiter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4">
        <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ember)]">Mesero</p>
          <h1 className="mt-2 text-3xl">{restaurantName}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Ingresa tu código de acceso.</p>
          <label className="mt-6 block text-sm font-semibold">
            Código
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
              className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 text-center text-2xl tracking-[0.3em]"
            />
          </label>
          {error ? <p className="mt-3 text-sm text-[var(--color-wine)]">{error}</p> : null}
          <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]">
            {loading ? "…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)] px-4 py-5">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">Mesero</p>
            <h1 className="text-2xl">{waiter.name}</h1>
          </div>
          <button type="button" onClick={() => setWaiter(null)} className="text-sm font-semibold">
            Salir
          </button>
        </div>

        <label className="mb-3 block text-sm font-semibold">
          Mesa
          <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3">
            <option value="">Selecciona</option>
            {allowedTables.map((t) => (
              <option key={t.id} value={t.id}>Mesa {t.number}</option>
            ))}
          </select>
        </label>

        <div className="mb-3 flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => setCat("")} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${!cat ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "bg-[var(--color-paper)]"}`}>Todos</button>
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${cat === c.id ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "bg-[var(--color-paper)]"}`}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((p) => (
            <button key={p.id} type="button" onClick={() => add(p)} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-left">
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{money(p.price)}</p>
            </button>
          ))}
        </div>

        <div className="sticky bottom-4 mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-lg">
          <p className="font-semibold">Cuenta · {money(total)}</p>
          <ul className="mt-2 max-h-28 overflow-y-auto text-sm">
            {cart.map((i) => (
              <li key={i.product_id}>{i.qty} × {i.name}</li>
            ))}
          </ul>
          {msg ? <p className="mt-2 text-sm">{msg}</p> : null}
          <button type="button" disabled={loading} onClick={send} className="mt-3 h-11 w-full rounded-full bg-[var(--color-ember)] font-semibold text-white">
            Enviar a cocina
          </button>
        </div>
      </div>
    </div>
  );
}
