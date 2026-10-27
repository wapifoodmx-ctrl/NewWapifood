"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function MesasManager({ restaurantId, initialTables }) {
  const [tables, setTables] = useState(initialTables);
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState("2");
  const [err, setErr] = useState("");

  async function addTable(e) {
    e.preventDefault();
    setErr("");
    const n = Number(number);
    const s = Number(seats);
    if (!n || n < 1) return setErr("Número de mesa inválido");
    if (!s || s < 1) return setErr("Lugares inválidos");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dining_tables")
      .insert({
        restaurant_id: restaurantId,
        number: n,
        seats: s,
        state: "libre",
        active: true,
      })
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setTables((t) => [...t, data].sort((a, b) => a.number - b.number));
    setNumber("");
    setSeats("2");
  }

  async function toggle(t) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dining_tables")
      .update({ active: !t.active })
      .eq("id", t.id)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setTables((xs) => xs.map((x) => (x.id === t.id ? data : x)));
  }

  async function remove(id) {
    if (!confirm("¿Eliminar mesa?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("dining_tables").delete().eq("id", id);
    if (error) return setErr(error.message);
    setTables((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tables.map((t) => (
          <article
            key={t.id}
            className={`rounded-2xl border p-4 ${
              t.active ? "border-[var(--color-line)] bg-[var(--color-paper)]" : "border-dashed border-[var(--color-line)] bg-[var(--color-cream)] opacity-70"
            }`}
          >
            <p className="text-2xl font-semibold">Mesa {t.number}</p>
            <p className="text-sm text-[var(--color-muted)]">{t.seats} lugares · {t.state}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => toggle(t)} className="text-xs font-semibold">
                {t.active ? "Desactivar" : "Activar"}
              </button>
              <button type="button" onClick={() => remove(t.id)} className="text-xs font-semibold text-[var(--color-wine)]">
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={addTable} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <h3 className="text-lg font-semibold">Nueva mesa</h3>
        <label className="mt-3 block text-sm font-semibold">
          Número
          <input type="number" min="1" required value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
        </label>
        <label className="mt-2 block text-sm font-semibold">
          Lugares
          <input type="number" min="1" required value={seats} onChange={(e) => setSeats(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
        </label>
        {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
        <button type="submit" className="mt-3 h-11 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]">
          Agregar mesa
        </button>
      </form>
    </div>
  );
}
