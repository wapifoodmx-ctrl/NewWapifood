"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { composeLineNote } from "@/lib/removable";
import { friendlyError } from "@/lib/brand";

export function ClosedTable({ slug, number, name }) {
  const [note, setNote] = useState("");

  async function callWaiter() {
    const supabase = createClient();
    const { error } = await supabase.rpc("call_waiter", {
      p_slug: slug,
      p_number: Number(number),
      p_token: null,
    });
    setNote(error ? error.message : "Ya avisamos. El mesero va para allá.");
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--ink)]">
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--primary)]">{name}</p>
      <h1 className="mt-2 text-4xl">Mesa {number}</h1>
      <p className="mt-4 text-xl">Pídele al mesero que abra tu mesa.</p>
      <button type="button" className="btn-primary mt-6 h-12 px-5 text-lg" onClick={callWaiter}>
        Llamar al mesero
      </button>
      {note ? <p className="mt-4 text-lg">{note}</p> : null}
    </main>
  );
}

export function TableOrder({ slug, number, token }) {
  const [menu, setMenu] = useState(null);
  const [bill, setBill] = useState(null);
  const [cart, setCart] = useState([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pick, setPick] = useState(null);

  async function load() {
    const supabase = createClient();
    const [{ data: menuData, error: menuError }, { data: billData }] = await Promise.all([
      supabase.rpc("get_table_menu", { p_token: token }),
      supabase.rpc("get_table_bill", { p_token: token }),
    ]);
    if (menuError) setError("Esta mesa ya se cerró. Pídele al mesero que la abra otra vez.");
    setMenu(menuData);
    setBill(billData);
  }

  useEffect(() => {
      const timer = setInterval(() => {
        load();
      }, 8000);
      const kick = setTimeout(() => {
        load();
      }, 0);
      return () => {
        clearInterval(timer);
        clearTimeout(kick);
      };
      // La carga habla con la base; no es estado derivado.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

  function removableOf(productId) {
    return (menu?.removable || []).filter((row) => row.product_id === productId);
  }

  function groupsOf(productId) {
    return (menu?.modifiers || []).filter((group) => group.product_id === productId);
  }

  function add(product, omitted = [], modifiers = [], freeNote = "") {
    const notes = composeLineNote(
      [freeNote, modifiers.map((item) => item.name).join(", ")].filter(Boolean).join(", "),
      omitted,
    );
    const modKey = modifiers.map((item) => item.option_id).sort().join(",");
    setCart((list) => {
      const found = list.find((row) => row.product_id === product.id && (row.notes || "") === notes && (row.modKey || "") === modKey);
      if (found) {
        return list.map((row) =>
          row.product_id === product.id && (row.notes || "") === notes && (row.modKey || "") === modKey
            ? { ...row, qty: row.qty + 1 }
            : row,
        );
      }
      return [...list, { product_id: product.id, name: product.name, qty: 1, notes, modifiers, modKey }];
    });
  }

  function choose(product) {
    if (removableOf(product.id).length || groupsOf(product.id).length) {
      setPick({ product, omitted: [], modifiers: [], note: "" });
      return;
    }
    add(product);
  }

  async function send() {
    setError("");
    const supabase = createClient();
    const { error: sendError } = await supabase.rpc("place_table_order", {
      p_token: token,
      p_items: cart.map((row) => ({
        product_id: row.product_id,
        qty: row.qty,
        notes: row.notes || "",
        modifiers: (row.modifiers || []).map((item) => ({ option_id: item.option_id })),
      })),
    });
    if (sendError) {
      setError(friendlyError(sendError.message));
      return;
    }
    setCart([]);
    setNote("Pedido enviado. Caja lo revisa.");
    load();
  }

  async function askBill() {
    const supabase = createClient();
    const { error: billError } = await supabase.rpc("ask_table_bill", { p_token: token });
    setNote(billError ? billError.message : "Ya pedimos la cuenta. No se paga aquí.");
  }

  if (error && !menu) {
    return <ClosedTable slug={slug} number={number} name="El restaurante" />;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--ink)]">
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--primary)]">{menu?.restaurant || "Tu mesa"}</p>
      <h1 className="text-4xl">Mesa {menu?.number || number}</h1>
      <p className="mt-2 text-lg">Toca un platillo para agregarlo. El precio lo pone el restaurante.</p>
      <div className="mt-4 grid gap-3">
        {(menu?.products || []).map((product) => (
          <button key={product.id} type="button" className="flex min-h-12 items-center justify-between rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-lg" onClick={() => choose(product)}>
            <span>{product.name}</span>
            <span className="font-bold">${Number(product.price).toFixed(0)}</span>
          </button>
        ))}
      </div>
      <section className="mt-6 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-2xl">Tu pedido</h2>
        {cart.length === 0 ? <p className="mt-2">Todavía no agregas nada.</p> : cart.map((row) => (
          <p key={`${row.product_id}-${row.notes}-${row.modKey}`} className="mt-2 text-lg">{row.qty} × {row.name}{row.notes ? ` · ${row.notes}` : ""}</p>
        ))}
        <button type="button" className="btn-primary mt-4 h-12 w-full text-lg" disabled={!cart.length} onClick={send}>Enviar pedido</button>
      </section>
      <section className="mt-4 rounded-[16px] border border-[var(--border)] p-4">
        <h2 className="text-2xl">Tu cuenta</h2>
        {(bill?.items || []).map((item, index) => (
          <p key={`${item.name}-${index}`} className="mt-2 text-lg">{item.qty} × {item.name}{item.notes ? ` · ${item.notes}` : ""} · {item.status === "preparado" ? "Listo" : "En cocina o en caja"}</p>
        ))}
        <p className="mt-3 text-2xl font-bold">Total ${Number(bill?.total || 0).toFixed(0)}</p>
        <button type="button" className="btn-ghost mt-3 h-12 w-full" onClick={askBill}>Pedir la cuenta</button>
      </section>
      {note ? <p className="mt-4 text-lg">{note}</p> : null}
      {pick ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[22px] bg-[var(--surface)] p-5">
            <h2 className="text-3xl">{pick.product.name}</h2>
            {removableOf(pick.product.id).map((row) => {
              const on = pick.omitted.some((item) => item.ingredient_id === row.ingredient_id);
              return (
                <label key={row.ingredient_id} className="mt-3 flex min-h-12 items-center gap-3 text-lg">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setPick((current) => ({
                        ...current,
                        omitted: on
                          ? current.omitted.filter((item) => item.ingredient_id !== row.ingredient_id)
                          : [...current.omitted, row],
                      }))
                    }
                  />
                  Sin {row.name}
                </label>
              );
            })}
            {groupsOf(pick.product.id).map((group) => (
              <fieldset key={group.group_id || group.group} className="mt-4">
                <legend className="text-lg font-bold">{group.group}{group.required ? " · elige" : ""}</legend>
                {(group.options || []).map((option) => {
                  const on = pick.modifiers.some((item) => item.option_id === option.id);
                  return (
                    <label key={option.id} className="mt-2 flex min-h-12 items-center justify-between gap-3 text-lg">
                      <span className="flex items-center gap-3">
                        <input
                          type={Number(group.max) === 1 ? "radio" : "checkbox"}
                          name={group.group_id || group.group}
                          checked={on}
                          onChange={() =>
                            setPick((current) => {
                              const optionIds = new Set((group.options || []).map((opt) => opt.id));
                              const rest = Number(group.max) === 1
                                ? current.modifiers.filter((item) => !optionIds.has(item.option_id))
                                : current.modifiers;
                              return {
                                ...current,
                                modifiers: on
                                  ? current.modifiers.filter((item) => item.option_id !== option.id)
                                  : [...rest, { option_id: option.id, name: option.name }],
                              };
                            })
                          }
                        />
                        {option.name}
                      </span>
                      {Number(option.price) > 0 ? <span>+${Number(option.price).toFixed(0)}</span> : null}
                    </label>
                  );
                })}
              </fieldset>
            ))}
            <label className="mt-4 block text-lg font-bold">
              Nota
              <input
                className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--bg)] px-3"
                value={pick.note}
                onChange={(e) => setPick((current) => ({ ...current, note: e.target.value }))}
                placeholder="Poco picante…"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn-ghost h-12 flex-1" onClick={() => setPick(null)}>Cancelar</button>
              <button
                type="button"
                className="btn-primary h-12 flex-1"
                onClick={() => {
                  add(pick.product, pick.omitted, pick.modifiers, pick.note);
                  setPick(null);
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
