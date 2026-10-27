"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ThemePanel({ restaurantId, initial }) {
  const [primary, setPrimary] = useState(initial?.primary_color || "#c45c26");
  const [secondary, setSecondary] = useState(initial?.secondary_color || "#1c1917");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase.from("menu_theme").upsert({
      restaurant_id: restaurantId,
      primary_color: primary,
      secondary_color: secondary,
    });
    if (error) setErr(error.message + " — ¿corriste SQL 004?");
    else setMsg("Colores del menú digital guardados.");
  }

  return (
    <form onSubmit={save} className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
      <h2 className="text-2xl">Colores del menú digital</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Se usarán en el menú QR / cliente.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Color principal
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-11 w-14 cursor-pointer rounded border border-[var(--color-line)] bg-transparent" />
            <input value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-11 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
          </div>
        </label>
        <label className="block text-sm font-semibold">
          Color secundario
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-11 w-14 cursor-pointer rounded border border-[var(--color-line)] bg-transparent" />
            <input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-11 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
          </div>
        </label>
      </div>
      <div
        className="mt-4 rounded-xl p-4 text-white"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        Vista previa del menú
      </div>
      {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
      {msg ? <p className="mt-2 text-sm text-[var(--color-sage)]">{msg}</p> : null}
      <button type="submit" className="mt-4 h-11 rounded-full bg-[var(--color-ink)] px-5 font-semibold text-[var(--color-cream)]">
        Guardar colores
      </button>
    </form>
  );
}
