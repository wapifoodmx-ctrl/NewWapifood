"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

  function add(product) {
    setCart((list) => {
      const found = list.find((row) => row.product_id === product.id);
      if (found) return list.map((row) => row.product_id === product.id ? { ...row, qty: row.qty + 1 } : row);
      return [...list, { product_id: product.id, name: product.name, qty: 1, notes: "" }];
    });
  }

  async function send() {
    setError("");
    const supabase = createClient();
    const { error: sendError } = await supabase.rpc("place_table_order", {
      p_token: token,
      p_items: cart.map((row) => ({ product_id: row.product_id, qty: row.qty, notes: row.notes })),
    });
    if (sendError) {
      setError(sendError.message);
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
          <button key={product.id} type="button" className="flex min-h-12 items-center justify-between rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-lg" onClick={() => add(product)}>
            <span>{product.name}</span>
            <span className="font-bold">${Number(product.price).toFixed(0)}</span>
          </button>
        ))}
      </div>
      <section className="mt-6 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-2xl">Tu pedido</h2>
        {cart.length === 0 ? <p className="mt-2">Todavía no agregas nada.</p> : cart.map((row) => (
          <p key={row.product_id} className="mt-2 text-lg">{row.qty} × {row.name}</p>
        ))}
        <button type="button" className="btn-primary mt-4 h-12 w-full text-lg" disabled={!cart.length} onClick={send}>Enviar pedido</button>
      </section>
      <section className="mt-4 rounded-[16px] border border-[var(--border)] p-4">
        <h2 className="text-2xl">Tu cuenta</h2>
        {(bill?.items || []).map((item, index) => (
          <p key={`${item.name}-${index}`} className="mt-2 text-lg">{item.qty} × {item.name} · {item.status === "preparado" ? "Listo" : "En cocina o en caja"}</p>
        ))}
        <p className="mt-3 text-2xl font-bold">Total ${Number(bill?.total || 0).toFixed(0)}</p>
        <button type="button" className="btn-ghost mt-3 h-12 w-full" onClick={askBill}>Pedir la cuenta</button>
      </section>
      {note ? <p className="mt-4 text-lg">{note}</p> : null}
    </main>
  );
}
