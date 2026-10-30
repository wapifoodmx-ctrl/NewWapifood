"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";

const CHANNELS = [
  { id: "caja", label: "Caja (POS)" },
  { id: "piso", label: "Piso" },
  { id: "tablet", label: "Tablet de mesa" },
  { id: "kiosko", label: "Kiosko" },
];

export function MesasManager({ restaurantId, initialTables }) {
  const [tables, setTables] = useState(initialTables);
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState("2");
  const [channel, setChannel] = useState("piso");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function ensureDefaults() {
    setErr("");
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase.rpc("ensure_channel_tables", {
      p_restaurant: restaurantId,
    });
    if (error) return setErr(error.message + " — ¿corriste SQL 013?");
    const { data } = await supabase
      .from("dining_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("number");
    setTables(data || []);
    setMsg("Canales base listos: caja (mesa 1) y kiosko.");
  }

  async function addTable(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
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
        channel_type: channel,
        access_pin: channel === "tablet" ? pin || null : null,
      })
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setTables((t) => [...t, data].sort((a, b) => a.number - b.number));
    setNumber("");
    setSeats("2");
    setPin("");
    setChannel("piso");
  }

  async function setType(t, type) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dining_tables")
      .update({ channel_type: type })
      .eq("id", t.id)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setTables((xs) => xs.map((x) => (x.id === t.id ? data : x)));
  }

  
  async function setState(t, state) {
    const supabase = createClient();
    const { error } = await supabase.rpc("set_table_state", { p_table: t.id, p_state: state });
    if (error) {
      // fallback direct update
      const { error: e2 } = await supabase.from("dining_tables").update({ state }).eq("id", t.id);
      if (e2) return toast?.error ? toast.error(error.message) : alert(error.message);
    }
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, state } : x)));
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
    if (!(await confirmAsync("¿Eliminar esta mesa?", { title: "Eliminar mesa" }))) return;
    const supabase = createClient();
    const { error } = await supabase.from("dining_tables").delete().eq("id", id);
    if (error) return setErr(error.message);
    setTables((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={ensureDefaults}
            className="h-10 rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold"
          >
            Crear caja + kiosko base
          </button>
          {msg ? <span className="text-sm text-[var(--color-sage)]">{msg}</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tables.map((t) => (
            <article
              key={t.id}
              className={`rounded-2xl border p-4 ${
                t.active
                  ? "border-[var(--color-line)] bg-[var(--color-paper)]"
                  : "border-dashed border-[var(--color-line)] bg-[var(--color-cream)] opacity-70"
              }`}
            >
              <p className="text-2xl font-semibold">Mesa {t.number}</p>
              <p className="text-sm text-[var(--color-muted)]">
                {t.seats} lugares · {t.state}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">
                {t.channel_type || "piso"}
              </p>
              <select
                className="mt-2 h-9 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-cream)] px-2 text-xs"
                value={t.channel_type || "piso"}
                onChange={(e) => setType(t, e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {(t.channel_type === "tablet" || t.channel_type === "piso") ? (
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--color-walnut)]">
                  Tablet: /tablet/{t.id}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => toggle(t)} className="text-xs font-semibold">
                  {t.active ? "Desactivar" : "Activar"}
                </button>
                <button type="button" onClick={() => setState(t, t.state === "no_disponible" ? "libre" : "no_disponible")} className="text-xs font-semibold">
                  {t.state === "no_disponible" ? "Habilitar" : "No disponible"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="text-xs font-semibold text-[var(--color-wine)]"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <form onSubmit={addTable} className="h-fit rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <h2 className="text-xl font-semibold">Nueva mesa / canal</h2>
        <label className="mt-3 block text-sm font-semibold">
          Número
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        <label className="mt-2 block text-sm font-semibold">
          Lugares
          <input
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        <label className="mt-2 block text-sm font-semibold">
          Canal
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          >
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {channel === "tablet" ? (
          <label className="mt-2 block text-sm font-semibold">
            PIN tablet (opcional)
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
            />
          </label>
        ) : null}
        {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
        <button
          type="submit"
          className="mt-4 h-11 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]"
        >
          Guardar
        </button>
      </form>
    </div>
  );
}
