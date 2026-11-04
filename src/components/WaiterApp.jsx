"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { toast } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { statusMeta, itemStatusMeta } from "@/lib/orderStatus";
import { extraPayload, extrasCharge, extrasForProduct } from "@/lib/extras";
import { ExtrasPicker } from "@/components/ExtrasPicker";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import { tableStateMeta } from "@/lib/brand";

const SESSION_KEY = "wapifood_waiter_session";

/**
 * Mini-sistema del mesero (paridad meseroMenu del Front).
 * Login por código → mesas asignadas → pedido → cocina → ver activas / historial corto.
 */
export function WaiterApp({
  restaurantId,
  restaurantName,
  products,
  categories,
  tables,
  canOperate,
  productExtras = [],
}) {
  const [session, setSession] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("pedir"); // pedir | activas | historial
  const [activeOrders, setActiveOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [extraPick, setExtraPick] = useState(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const kick = setTimeout(() => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s?.restaurant_id === restaurantId) setSession(s);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(kick);
  }, [restaurantId]);

  const allowedTables = useMemo(() => {
    if (!session) return [];
    const ids = session.table_ids || [];
    if (!ids.length) return tables.filter((t) => t.channel_type !== "kiosko");
    return tables.filter((t) => ids.includes(t.id));
  }, [session, tables]);

  const list = products.filter((p) => p.active !== false && (!cat || p.category_id === cat));
  const total = cart.reduce((s, i) => s + (Number(i.price) + extrasCharge(i.extras)) * i.qty, 0);
  const productName = (id) => products.find((p) => p.id === id)?.name || "Producto";

  async function loadOrders() {
    if (!session) return;
    const tableIds = allowedTables.map((t) => t.id);
    if (!tableIds.length) {
      setActiveOrders([]);
      setHistory([]);
      return;
    }
    const { data: act } = await supabase
      .from("orders")
      .select("id,status,source,opened_at,waiter_id,order_items(product_id,qty,status),dining_tables(number)")
      .eq("restaurant_id", restaurantId)
      .in("table_id", tableIds)
      .in("status", ["abierta", "cocina", "lista", "pendiente"])
      .order("opened_at", { ascending: false })
      .limit(30);

    const { data: hist } = await supabase
      .from("orders")
      .select("id,status,source,opened_at,closed_at,waiter_id,order_items(product_id,qty,unit_price),dining_tables(number)")
      .eq("restaurant_id", restaurantId)
      .in("table_id", tableIds)
      .in("status", ["pagada", "entregada", "cancelada"])
      .order("opened_at", { ascending: false })
      .limit(20);

    setActiveOrders(act || []);
    setHistory(hist || []);
  }

  useEffect(() => {
    if (!session) return undefined;
    const kick = setTimeout(() => {
      loadOrders();
    }, 0);
    return () => clearTimeout(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab]);

  useEffect(() => {
    if (!session || !restaurantId) return undefined;
    const kick = setTimeout(() => {
      loadOrders();
    }, 0);
    const channel = supabase
      .channel(`waiter-live-${restaurantId}-${session.waiter_id || "x"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => loadOrders(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => loadOrders(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dining_tables", filter: `restaurant_id=eq.${restaurantId}` },
        () => loadOrders(),
      )
      .subscribe();
    return () => {
      clearTimeout(kick);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, restaurantId]);

async function login(e) {
    e.preventDefault();
    setError("");
    if (!canOperate) {
      setError("El restaurante no tiene plan activo.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.rpc("waiter_login", {
        p_restaurant: restaurantId,
        p_code: code.trim(),
      });
      if (err) throw err;
      const s = {
        ...data,
        access_code: code.trim(),
        restaurant_id: restaurantId,
        restaurant_name: restaurantName,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
      setCode("");
      toast.success(`Hola, ${data?.name || "mesero"}`);
    } catch (e2) {
      setError(e2.message || "Código inválido");
      toast.error(e2.message || "Código inválido");
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

  function add(p, selected = []) {
    setCart((c) => {
      const f = c.find((x) => x.product_id === p.id);
      if (f) {
        return c.map((x) =>
          x.product_id === p.id ? { ...x, qty: x.qty + 1, extras: selected.length ? selected : x.extras || [] } : x,
        );
      }
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1, extras: selected }];
    });
  }

  function choose(p) {
    if (extrasForProduct(productExtras, p.id).length) {
      setExtraPick({ product: p, selected: [] });
      return;
    }
    add(p, []);
  }

  function dec(id) {
    setCart((c) =>
      c.map((x) => (x.product_id === id ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0),
    );
  }

  async function send() {
    if (!tableId) return toast.warning("Elige una mesa");
    if (!cart.length) return toast.warning("Carrito vacío");
    setLoading(true);
    try {
      const { data: orderId, error } = await supabase.rpc("place_public_order", {
        p_restaurant: restaurantId,
        p_table: tableId,
        p_items: cart.map((i) => ({
          product_id: i.product_id,
          qty: i.qty,
          extras: extraPayload(i.extras),
        })),
        p_customer_name: session?.name || "Mesero",
        p_notes: null,
        p_confirm_code: null,
        p_source: "mesero",
      });
      if (error) throw error;

      if (orderId && session?.id && session?.access_code) {
        const { error: e2 } = await supabase.rpc("set_order_waiter", {
          p_order: orderId,
          p_waiter: session.id,
          p_code: session.access_code,
        });
        if (e2) {
          // no bloquea el pedido
          console.warn(e2.message);
        }
      }

      setCart([]);
      toast.success("Comanda enviada a cocina");
      await loadOrders();
      setTab("activas");
    } catch (e) {
      toast.error(e.message || "Error al enviar");
    } finally {
      setLoading(false);
    }
  }

  if (!canOperate) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-parchment)] px-4">
        <div className="max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8 text-center">
          <h1 className="text-2xl font-normal">Mesero no disponible</h1>
          <p className="mt-2 text-[var(--color-espresso)]">El restaurante necesita un plan activo.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-parchment)] px-4">
        <LoadingOverlay visible={loading} />
        <form onSubmit={login} className="w-full max-w-sm border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-saffron-glow)]">
            {restaurantName}
          </p>
          <h1 className="mt-2 text-3xl font-normal">Acceso mesero</h1>
          <p className="mt-2 text-sm text-[var(--color-espresso)]">
            Ingresa tu código de acceso (no uses la cuenta del dueño).
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-5 h-12 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] text-center text-xl tracking-[0.25em]"
            placeholder="Código"
            autoFocus
          />
          {error ? <p className="mt-2 text-sm text-[var(--color-wine)]">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 h-12 w-full rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] text-[var(--color-onyx-warm)]">
      <LoadingOverlay visible={loading} message="Procesando…" />
      <header className="border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-saffron-glow)]">
              {session.restaurant_name || restaurantName}
            </p>
            <h1 className="text-xl font-normal">{session.name || "Mesero"}</h1>
          </div>
          <button type="button" onClick={logout} className="text-xs font-semibold uppercase">
            Salir
          </button>
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl gap-1">
          {[
            { id: "pedir", label: "Pedir" },
            { id: "activas", label: "Activas" },
            { id: "historial", label: "Historial" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-10 flex-1 rounded-[3px] text-xs font-semibold uppercase ${
                tab === t.id
                  ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                  : "bg-[var(--color-parchment)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-24">
        {tab === "pedir" ? (
          <>
            <fieldset>
              <legend className="text-lg font-extrabold">¿En qué mesa?</legend>
              <div className="pos-tables-grid mt-2">
                {allowedTables.map((t) => {
                  const meta = tableStateMeta(t.state, t.state === "ocupada");
                  const on = tableId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTableId(t.id)}
                      className={`table-tile tone-${meta.tone} ${on ? "is-on" : ""}`}
                    >
                      <Icon name={meta.icon} size={20} />
                      <span className="table-tile-name">Mesa {t.number}</span>
                      <span className="table-tile-state">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              {!allowedTables.length ? (
                <EmptyState icon="table" title="No tienes mesas" text="Pide en caja que te asignen una mesa." />
              ) : null}
            </fieldset>

            <div className="mt-3 flex gap-1 overflow-x-auto">
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

            <div className="pos-grid mt-3">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p)}
                  className="pos-tile"
                >
                  <span className="pos-tile-media" style={{ background: "var(--primary-solid)", color: "var(--on-solid)" }}>
                    {(p.name || "?").slice(0, 1)}
                  </span>
                  <span className="pos-tile-body">
                    <span className="pos-tile-name">{p.name}</span>
                    <span className="pos-tile-price">{money(p.price)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="menu-dock">
              <div className="min-w-0">
                <p className="text-2xl font-extrabold">{money(total)}</p>
                <p className="truncate text-sm">
                  {cart.length
                    ? cart.map((i) => `${i.qty}× ${i.name}`).join(" · ")
                    : "Toca un platillo. Toca de nuevo el nombre abajo para quitar uno."}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {cart.map((i) => (
                    <button key={i.product_id} type="button" onClick={() => dec(i.product_id)} className="btn-ghost px-2 text-sm">
                      − {i.name}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={send} className="btn-lg btn-primary shrink-0 px-4">
                Enviar a cocina
              </button>
            </div>
          </>
        ) : null}

        {tab === "activas" ? (
          <div className="space-y-3">
            <button type="button" onClick={loadOrders} className="text-xs font-semibold uppercase">
              Actualizar
            </button>
            {activeOrders.map((o) => (
              <article key={o.id} className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
                <div className="flex justify-between">
                  <p className="font-semibold">Mesa {o.dining_tables?.number ?? "—"}</p>
                  <span className="text-xs font-bold uppercase">{statusMeta(o.status).label}</span>
                </div>
                <ul className="mt-2 text-sm text-[var(--color-espresso)]">
                  {(o.order_items || []).map((i) => (
                    <li key={`${o.id}-${i.product_id}`} className={itemStatusMeta(i.status).color}>
                      {i.qty}× {productName(i.product_id)} · {itemStatusMeta(i.status).label}
                    </li>
                  ))}
                </ul>
                {o.waiter_id === session.id ? (
                  <p className="mt-1 text-[11px] text-[var(--color-saffron-glow)]">Tu comanda</p>
                ) : null}
              </article>
            ))}
            {!activeOrders.length ? (
              <p className="text-[var(--color-walnut)]">No hay órdenes activas en tus mesas.</p>
            ) : null}
          </div>
        ) : null}

        {tab === "historial" ? (
          <div className="space-y-3">
            <button type="button" onClick={loadOrders} className="text-xs font-semibold uppercase">
              Actualizar
            </button>
            {history.map((o) => {
              const tot = (o.order_items || []).reduce(
                (s, i) => s + Number(i.unit_price || 0) * Number(i.qty),
                0,
              );
              return (
                <article key={o.id} className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold">Mesa {o.dining_tables?.number ?? "—"}</p>
                    <span className="text-xs font-bold uppercase">{statusMeta(o.status).label}</span>
                  </div>
                  <p className="text-sm text-[var(--color-espresso)]">{money(tot)}</p>
                  <a href={`/t/${o.id}`} className="mt-1 inline-block text-xs font-semibold uppercase text-[var(--color-saffron-glow)]">
                    Ver ticket
                  </a>
                </article>
              );
            })}
            {!history.length ? (
              <p className="text-[var(--color-walnut)]">Sin historial reciente en tus mesas.</p>
            ) : null}
          </div>
        ) : null}
      </main>
      {extraPick ? (
        <div className="fixed inset-0 z-[1700] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="waiter-extra-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5">
            <h2 id="waiter-extra-title" className="text-2xl font-normal">{extraPick.product.name}</h2>
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
            <div className="mt-4 flex gap-2">
              <button type="button" className="h-11 flex-1 border border-[var(--color-warm-stone)] text-xs font-semibold uppercase" onClick={() => setExtraPick(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="h-11 flex-1 bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]"
                onClick={() => {
                  add(extraPick.product, extraPick.selected);
                  setExtraPick(null);
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
