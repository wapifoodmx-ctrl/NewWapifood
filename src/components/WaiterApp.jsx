"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

const SESSION_KEY = "wapifood_waiter_session";

/**
 * Mini-sistema del mesero (NO panel admin).
 * Login por código → solo mesas asignadas → tomar pedido → cocina.
 */
export function WaiterApp({ restaurantId, restaurantName, products, categories, tables, canOperate }) {
  const [session, setSession] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("pedir"); // pedir | activas

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.restaurant_id === restaurantId) setSession(s);
    } catch {
      /* ignore */
    }
  }, [restaurantId]);

  const allowedTables = useMemo(() => {
    if (!session) return [];
    const ids = session.table_ids || [];
    if (!ids.length) return tables;
    return tables.filter((t) => ids.includes(t.id));
  }, [session, tables]);

  const list = products.filter((p) => !cat || p.category_id === cat);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  async function login(e) {
    e.preventDefault();
    setError("");
    if (!canOperate) {
      setError("El restaurante no tiene plan activo. No se puede operar como mesero.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error: err } = await supabase.rpc("waiter_login", {
        p_restaurant: restaurantId,
        p_code: code,
      });
      if (err) throw err;
      const s = { ...data, restaurant_id: restaurantId, restaurant_name: restaurantName };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
      setCode("");
    } catch (e2) {
      setError(e2.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCart([]);
    setTableId("");
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
    if (!tableId) return setMsg("Elige una mesa");
    if (!cart.length) return setMsg("Carrito vacío");
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("place_public_order", {
        p_restaurant: restaurantId,
        p_table: tableId,
        p_items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        p_customer_name: session?.name || "Mesero",
        p_notes: null,
        p_confirm_code: null,
        p_source: "mesero",
      });
      if (error) throw error;
      setCart([]);
      setMsg("Comanda enviada a cocina");
    } catch (e) {
      setMsg(e.message || "Error al enviar");
    } finally {
      setLoading(false);
    }
  }

  if (!canOperate) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-cream)] px-4">
        <div className="max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-center">
          <h1 className="text-2xl font-semibold">Meseros no disponibles</h1>
          <p className="mt-2 text-[var(--color-muted)]">
            El dueño debe activar un plan de Wapifood para operar el canal de meseros.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4">
        <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ember)]">Acceso mesero</p>
          <h1 className="mt-2 text-3xl">{restaurantName}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Este no es el panel del dueño. Solo personal de piso con su código.
          </p>
          <label className="mt-6 block text-sm font-semibold">
            Código de acceso
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
              className="mt-1 h-14 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 text-center text-3xl tracking-[0.35em]"
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
    <div className="min-h-screen bg-[var(--color-cream)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">Mesero</p>
            <h1 className="text-xl font-semibold">{session.name}</h1>
            <p className="text-xs text-[var(--color-muted)]">{restaurantName}</p>
          </div>
          <button type="button" onClick={logout} className="text-sm font-semibold">
            Salir
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-3xl gap-2">
          <button type="button" onClick={() => setTab("pedir")} className={`h-10 flex-1 rounded-full text-sm font-semibold ${tab === "pedir" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "bg-[var(--color-cream)]"}`}>
            Tomar pedido
          </button>
          <button type="button" onClick={() => setTab("mesas")} className={`h-10 flex-1 rounded-full text-sm font-semibold ${tab === "mesas" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "bg-[var(--color-cream)]"}`}>
            Mis mesas
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-32">
        {tab === "mesas" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {allowedTables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTableId(t.id);
                  setTab("pedir");
                }}
                className={`rounded-2xl border p-4 text-left ${tableId === t.id ? "border-[var(--color-ember)] bg-[var(--color-ember)] text-white" : "border-[var(--color-line)] bg-[var(--color-paper)]"}`}
              >
                <p className="text-2xl font-semibold">Mesa {t.number}</p>
                <p className="text-sm opacity-80">{t.seats} lugares</p>
              </button>
            ))}
            {allowedTables.length === 0 ? (
              <p className="col-span-full text-[var(--color-muted)]">No tienes mesas asignadas. Pide al dueño que te asigne en Meseros.</p>
            ) : null}
          </div>
        ) : (
          <>
            <label className="mb-3 block text-sm font-semibold">
              Mesa del pedido
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3"
              >
                <option value="">Selecciona mesa</option>
                {allowedTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number}
                  </option>
                ))}
              </select>
            </label>

            <div className="mb-3 flex gap-2 overflow-x-auto">
              <button type="button" onClick={() => setCat("")} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${!cat ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "bg-[var(--color-paper)]"}`}>
                Todos
              </button>
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
          </>
        )}
      </main>

      {tab === "pedir" ? (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <div className="mx-auto max-w-3xl">
            <p className="font-semibold">Cuenta · {money(total)}</p>
            <ul className="mt-1 max-h-20 overflow-y-auto text-sm text-[var(--color-muted)]">
              {cart.map((i) => (
                <li key={i.product_id}>
                  {i.qty} × {i.name}
                </li>
              ))}
            </ul>
            {msg ? <p className="mt-1 text-sm">{msg}</p> : null}
            <button type="button" disabled={loading} onClick={send} className="mt-2 h-12 w-full rounded-full bg-[var(--color-ember)] font-semibold text-white">
              Enviar a cocina
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
