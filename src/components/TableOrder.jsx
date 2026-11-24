"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { composeLineNote, removableForProduct } from "@/lib/removable";
import { friendlyError } from "@/lib/brand";
import { money } from "@/lib/format";
import { EmptyState, Skeleton } from "@/components/ui/States";
import {
  addCartLine,
  billLineTotal,
  cartCount,
  cartTotal,
  lineTotal,
  categoryName,
  changeQty,
  itemWord,
  menuCategories,
  modifierIssue,
  productsInCategory,
  rejectedText,
  requestItemNames,
  requestWord,
  sendNote,
  toggleTableModifier,
} from "@/lib/tableMenu";

function toneClass(tone) {
  if (tone === "ok") return "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-fg)]";
  if (tone === "bad") return "bg-[var(--chip-bad-bg)] text-[var(--chip-bad-fg)]";
  return "bg-[var(--chip-warn-bg)] text-[var(--chip-warn-fg)]";
}

function StatusWord({ tone, children }) {
  return <span className={`chip ${toneClass(tone)}`}>{children}</span>;
}

function groupsOf(menu, productId) {
  return (menu?.modifiers || []).filter((group) => group.product_id === productId);
}

function needsCustomize(menu, productId) {
  return groupsOf(menu, productId).length > 0 || removableForProduct(menu?.removable, productId).length > 0;
}

function cartLine(product, omitted, modifiers, freeNote, qty) {
  const notes = composeLineNote(
    [freeNote, (modifiers || []).map((item) => item.name).filter(Boolean).join(", ")].filter(Boolean).join(", "),
    omitted,
  );
  const modKey = (modifiers || []).map((item) => item.option_id).sort().join(",");
  return {
    product_id: product.id,
    name: product.name,
    price: Number(product.price),
    qty: qty || 1,
    notes,
    modifiers: modifiers || [],
    modKey,
  };
}

export function ClosedTable({ slug, number, name }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function callWaiter() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("call_waiter", {
      p_slug: slug,
      p_number: Number(number),
      p_token: null,
    });
    setBusy(false);
    setNote(error ? friendlyError(error.message) : "Ya avisamos. El mesero va para allá.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-[var(--bg)] px-4 py-10 text-[var(--ink)]">
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--primary)]">{name}</p>
      <h1 className="mt-2 text-4xl">Mesa {number}</h1>
      <p className="mt-4">
        <StatusWord tone="bad">Cerrada</StatusWord>
      </p>
      <p className="mt-4 text-xl">Pídele al mesero que abra tu mesa. Sin eso el celular no puede pedir.</p>
      <button type="button" className="btn btn-lg btn-primary mt-6 w-full" disabled={busy} onClick={callWaiter}>
        Llamar al mesero
      </button>
      {note ? <p className="mt-4 text-lg" role="status">{note}</p> : null}
    </main>
  );
}

export function TableOrder({ slug, number, token }) {
  const [menu, setMenu] = useState(null);
  const [bill, setBill] = useState(null);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pick, setPick] = useState(null);
  const [pickError, setPickError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [place, setPlace] = useState("El restaurante");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    const supabase = createClient();
    const [{ data: menuData, error: menuError }, { data: billData }] = await Promise.all([
      supabase.rpc("get_table_menu", { p_token: token }),
      supabase.rpc("get_table_bill", { p_token: token }),
    ]);
    if (menuError && /cerrad/i.test(menuError.message || "")) {
      setClosed(true);
    } else if (menuError) {
      setError(friendlyError(menuError.message));
    } else {
      setClosed(false);
      setMenu(menuData);
      if (menuData?.restaurant) setPlace(menuData.restaurant);
      setError("");
    }
    if (billData) setBill(billData);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setInterval(load, 8000);
    const kick = setTimeout(load, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(kick);
    };
    // La carga habla con la base; no es estado derivado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!pick && !cartOpen) return undefined;
    function onKey(event) {
      if (event.key !== "Escape") return;
      setPick(null);
      setPickError("");
      setCartOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, cartOpen]);

  async function callWaiter() {
    const supabase = createClient();
    const { error: callError } = await supabase.rpc("call_waiter", {
      p_slug: slug,
      p_number: Number(number),
      p_token: token,
    });
    setNote(callError ? friendlyError(callError.message) : "Ya avisamos. El mesero va para allá.");
  }

  function add(product, omitted = [], modifiers = [], freeNote = "", qty = 1) {
    setCart((list) => addCartLine(list, cartLine(product, omitted, modifiers, freeNote, qty)));
    setNote("");
  }

  function choose(product) {
    if (needsCustomize(menu, product.id)) {
      setPickError("");
      setPick({ product, omitted: [], modifiers: [], note: "", qty: 1 });
      return;
    }
    add(product);
  }

  function confirmPick() {
    const groups = groupsOf(menu, pick.product.id);
    const issue = modifierIssue(groups, pick.modifiers);
    if (issue) {
      setPickError(issue);
      return;
    }
    add(pick.product, pick.omitted, pick.modifiers, pick.note, pick.qty);
    setPick(null);
  }

  async function send() {
    setSending(true);
    setError("");
    const supabase = createClient();
    const { data, error: sendError } = await supabase.rpc("place_table_order", {
      p_token: token,
      p_items: cart.map((row) => ({
        product_id: row.product_id,
        qty: row.qty,
        notes: row.notes || "",
        modifiers: (row.modifiers || []).map((item) => ({ option_id: item.option_id })),
      })),
    });
    setSending(false);
    if (sendError) {
      setError(friendlyError(sendError.message));
      return;
    }
    setCart([]);
    setCartOpen(false);
    setNote(sendNote(Boolean(data?.accepted)));
    load();
  }

  async function askBill() {
    const supabase = createClient();
    const { error: billError } = await supabase.rpc("ask_table_bill", { p_token: token });
    setNote(billError ? friendlyError(billError.message) : "Ya pedimos la cuenta. El cobro es en la mesa.");
    if (!billError) load();
  }

  if (closed) return <ClosedTable slug={slug} number={number} name={place} />;

  const products = productsInCategory(menu?.products, category);
  const categories = menuCategories(menu?.products);
  const count = cartCount(cart);

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-[var(--bg)] px-4 py-6 pb-8 text-[var(--ink)]">
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--primary)]">{menu?.restaurant || "Tu mesa"}</p>
      <h1 className="text-4xl">Mesa {menu?.number || number}</h1>
      <p className="mt-2 text-lg text-[var(--ink-soft)]">Toca un platillo para agregarlo. El cobro es en la mesa.</p>
      <button type="button" className="btn btn-ghost mt-4" onClick={callWaiter}>Llamar al mesero</button>

      {loading && !menu ? (
        <div className="menu-grid mt-6" aria-hidden="true">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : null}

      {menu ? (
        <>
          <div className="cat-row mt-5" aria-label="Categorías">
            <button type="button" className={`cat-chip ${category ? "" : "is-on"}`} aria-pressed={!category} onClick={() => setCategory("")}>Todos</button>
            {categories.map((name) => (
              <button key={name} type="button" className={`cat-chip ${category === name ? "is-on" : ""}`} aria-pressed={category === name} onClick={() => setCategory(name)}>
                {name}
              </button>
            ))}
          </div>
          {products.length ? (
            <div className="menu-grid mt-4">
              {products.map((product) => (
                <article key={product.id} className="menu-card">
                  <div className="menu-photo">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt={product.name} />
                    ) : (
                      <span>{(product.name || "?").slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="px-3 pb-2 pt-3">
                    <p className="text-sm font-bold text-[var(--ink-soft)]">{categoryName(product)}</p>
                    <h2 className="text-lg">{product.name}</h2>
                    <p className="font-bold">{money(product.price)}</p>
                  </div>
                  <button type="button" className="btn btn-primary mx-3 mb-3 w-[calc(100%-1.5rem)]" onClick={() => choose(product)}>
                    {needsCustomize(menu, product.id) ? "Elegir" : "Agregar"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState icon="dish" title="No hay platillos en esta lista" text="Prueba otra categoría o pídele al mesero." />
            </div>
          )}
        </>
      ) : null}

      <section className="mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-1)]">
        <h2 className="text-2xl">Tu cuenta</h2>
        {(bill?.pending || []).map((row) => {
          const meta = requestWord(row.kind);
          return (
            <p key={row.id} className="mt-3 text-lg">
              <StatusWord tone="warn">{meta.word}</StatusWord>{" "}
              {meta.text} {requestItemNames(row.items).join(", ")}
            </p>
          );
        })}
        {(bill?.rejected || []).map((row) => (
          <p key={row.id} className="mt-3 text-lg">
            <StatusWord tone="bad">No aceptado</StatusWord>{" "}
            {rejectedText(row.reason)} {requestItemNames(row.items).join(", ")}
          </p>
        ))}
        {(bill?.items || []).length ? (bill.items || []).map((item, index) => {
          const meta = itemWord(item.status);
          return (
            <p key={`${item.name}-${index}`} className="mt-3 text-lg">
              {item.qty} × {item.name}
              {item.notes ? ` · ${item.notes}` : ""}
              {(item.extras || []).map((extra) => ` · ${extra.name}`).join("")}
              {" · "}
              <StatusWord tone={meta.tone}>{meta.word}</StatusWord>
              {" "}
              {money(billLineTotal(item))}
            </p>
          );
        }) : <p className="mt-2 text-[var(--ink-soft)]">Cuando caja acepte el pedido, los platillos aparecen aquí.</p>}
        <p className="mt-4 text-2xl font-extrabold">Total {money(bill?.total || 0)}</p>
        {bill?.public_code ? <p className="mt-1 text-[var(--ink-soft)]">Código {bill.public_code}</p> : null}
        {bill?.order_id ? (
          <Link className="mt-3 inline-flex min-h-12 items-center font-bold text-[var(--primary)]" href={`/t/${bill.order_id}`}>
            Ver el estado del pedido
          </Link>
        ) : null}
        <button type="button" className="btn btn-lg btn-ghost mt-4 w-full" onClick={askBill}>Pide la cuenta</button>
        <p className="mt-2 text-[var(--ink-soft)]">No se paga en el celular.</p>
      </section>

      {error ? <p className="mt-4 text-lg text-[var(--wine)]" role="alert">{error}</p> : null}
      {note ? <p className="mt-4 text-lg" role="status">{note}</p> : null}

      {count > 0 ? (
        <div className="menu-dock">
          <div>
            <p className="text-sm font-bold opacity-80">{count} {count === 1 ? "platillo" : "platillos"}</p>
            <p className="text-2xl font-extrabold">{money(cartTotal(cart))}</p>
          </div>
          <button type="button" className="btn btn-lg btn-primary" onClick={() => setCartOpen(true)}>Ver pedido</button>
        </div>
      ) : null}

      {cartOpen ? (
        <Sheet title="Tu pedido" labelledBy="pedido-titulo" onClose={() => setCartOpen(false)}>
          <h2 id="pedido-titulo" className="text-3xl">Tu pedido</h2>
          {cart.map((row, index) => (
            <div key={`${row.product_id}-${row.notes}-${row.modKey}`} className="mt-4 flex items-center justify-between gap-3">
              <p className="text-lg">
                {row.name}
                {row.notes ? <span className="block text-base text-[var(--ink-soft)]">{row.notes}</span> : null}
                <span className="block font-bold">{money(lineTotal(row))}</span>
              </p>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-ghost w-12 px-0" aria-label={`Quitar un ${row.name}`} onClick={() => setCart((list) => changeQty(list, index, -1))}>−</button>
                <span className="min-w-6 text-center text-lg font-extrabold">{row.qty}</span>
                <button type="button" className="btn btn-ghost w-12 px-0" aria-label={`Agregar otro ${row.name}`} onClick={() => setCart((list) => changeQty(list, index, 1))}>+</button>
              </div>
            </div>
          ))}
          <p className="mt-4 text-2xl font-extrabold">Total {money(cartTotal(cart))}</p>
          <button type="button" className="btn btn-lg btn-primary mt-4 w-full" disabled={!cart.length || sending} onClick={send}>
            {sending ? "Enviando…" : "Enviar pedido"}
          </button>
        </Sheet>
      ) : null}

      {pick ? (
        <Sheet title={pick.product.name} labelledBy="elige-titulo" onClose={() => setPick(null)}>
          <h2 id="elige-titulo" className="text-3xl">{pick.product.name}</h2>
          <p className="mt-1 text-lg font-bold">{money(pick.product.price)}</p>
          {removableForProduct(menu?.removable, pick.product.id).map((row) => {
            const on = pick.omitted.some((item) => item.ingredient_id === row.ingredient_id);
            return (
              <label key={row.ingredient_id} className="mt-3 flex min-h-12 items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setPick((current) => ({
                    ...current,
                    omitted: on
                      ? current.omitted.filter((item) => item.ingredient_id !== row.ingredient_id)
                      : [...current.omitted, row],
                  }))}
                />
                Sin {row.name}
              </label>
            );
          })}
          {groupsOf(menu, pick.product.id).map((group) => (
            <fieldset key={group.group_id || group.group} className="mt-4">
              <legend className="text-lg font-extrabold">{group.group}{group.required ? " · elige" : ""}</legend>
              {(group.options || []).map((option) => {
                const on = pick.modifiers.some((item) => item.option_id === option.id);
                return (
                  <label key={option.id} className="mt-2 flex min-h-12 items-center justify-between gap-3 text-lg">
                    <span className="flex items-center gap-3">
                      <input
                        type={Number(group.max) === 1 ? "radio" : "checkbox"}
                        name={group.group_id || group.group}
                        checked={on}
                        onChange={() => setPick((current) => ({
                          ...current,
                          modifiers: toggleTableModifier(current.modifiers, option, group),
                        }))}
                      />
                      {option.name}
                    </span>
                    {Number(option.price) > 0 ? <span>+{money(option.price)}</span> : null}
                  </label>
                );
              })}
            </fieldset>
          ))}
          <label className="mt-4 block text-lg font-extrabold">
            Nota
            <input
              className="wf-input mt-1"
              value={pick.note}
              onChange={(event) => setPick((current) => ({ ...current, note: event.target.value }))}
              placeholder="Poco picante"
            />
          </label>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="btn btn-ghost w-12 px-0" aria-label="Menos" onClick={() => setPick((current) => ({ ...current, qty: Math.max(1, current.qty - 1) }))}>−</button>
            <span className="text-lg font-extrabold">{pick.qty}</span>
            <button type="button" className="btn btn-ghost w-12 px-0" aria-label="Más" onClick={() => setPick((current) => ({ ...current, qty: Math.min(20, current.qty + 1) }))}>+</button>
          </div>
          {pickError ? <p className="mt-3 text-[var(--wine)]" role="alert">{pickError}</p> : null}
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setPick(null)}>Cancelar</button>
            <button type="button" className="btn btn-lg btn-primary flex-1" onClick={confirmPick}>Agregar</button>
          </div>
        </Sheet>
      ) : null}
    </main>
  );
}

function Sheet({ title, labelledBy, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label={`Cerrar ${title}`} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-sheet)] bg-[var(--surface)] p-5 text-[var(--ink)] shadow-[var(--shadow-2)] sm:rounded-[var(--radius-sheet)]">
        {children}
      </div>
    </div>
  );
}
