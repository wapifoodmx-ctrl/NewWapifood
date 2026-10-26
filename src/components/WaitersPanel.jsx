"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function WaitersPanel({ restaurantId, initialWaiters }) {
  const [waiters, setWaiters] = useState(initialWaiters);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function addWaiter(e) {
    e.preventDefault();
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("waiters")
      .insert({ restaurant_id: restaurantId, name, access_code: code })
      .select("*")
      .single();
    if (err) {
      setError(err.message + " — ¿ya corriste supabase/004_schema_saas_completo.sql?");
      return;
    }
    setWaiters((w) => [...w, data]);
    setName("");
    setCode("");
  }

  async function removeWaiter(id) {
    const supabase = createClient();
    await supabase.from("waiters").delete().eq("id", id);
    setWaiters((w) => w.filter((x) => x.id !== id));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={addWaiter} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <h2 className="text-2xl">Nuevo mesero</h2>
        <label className="mt-3 block text-sm font-semibold">
          Nombre
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Código de acceso
          <input
            required
            minLength={4}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        {error ? <p className="mt-2 text-sm text-[var(--color-wine)]">{error}</p> : null}
        <button type="submit" className="mt-4 h-11 rounded-full bg-[var(--color-ink)] px-5 font-semibold text-[var(--color-cream)]">
          Guardar
        </button>
      </form>
      <div className="space-y-2">
        {waiters.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3">
            <div>
              <p className="font-semibold">{w.name}</p>
              <p className="text-sm text-[var(--color-muted)]">código {w.access_code}</p>
            </div>
            <button type="button" onClick={() => removeWaiter(w.id)} className="text-sm font-semibold text-[var(--color-wine)]">
              Eliminar
            </button>
          </div>
        ))}
        {waiters.length === 0 ? <p className="text-[var(--color-muted)]">Aún no hay meseros.</p> : null}
      </div>
    </div>
  );
}
