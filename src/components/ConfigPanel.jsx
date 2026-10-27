"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadPublicImage } from "@/lib/storage";

export function ConfigPanel({ restaurant, profile }) {
  const [form, setForm] = useState({
    name: restaurant?.name || "",
    phone: profile?.phone || "",
    whatsapp: profile?.whatsapp || "",
    address: profile?.address || "",
    city: profile?.city || "",
    schedule: profile?.schedule || "",
    logo_url: restaurant?.logo_url || "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setLoading(true);
    try {
      const supabase = createClient();
      const url = await uploadPublicImage(supabase, restaurant.id, file, "logos");
      set("logo_url", url);
      setMsg("Logo subido. Guarda los cambios para aplicarlo.");
    } catch (e2) {
      setErr(e2.message || "No se pudo subir el logo (¿corriste SQL 006 y el bucket?)");
    } finally {
      setLoading(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!form.name.trim() || form.name.trim().length < 2) {
      setErr("El nombre del restaurante debe tener al menos 2 caracteres.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { error: e1 } = await supabase
        .from("restaurants")
        .update({ name: form.name.trim(), logo_url: form.logo_url || null })
        .eq("id", restaurant.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("restaurant_profiles").upsert({
        restaurant_id: restaurant.id,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        address: form.address || null,
        city: form.city || null,
        schedule: form.schedule || null,
        updated_at: new Date().toISOString(),
      });
      if (e2) throw e2;
      setMsg("Datos del restaurante guardados.");
    } catch (e3) {
      setErr(e3.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSave} className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 text-center">
        <div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-2xl bg-[var(--color-cream)]">
          {form.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-[var(--color-muted)]">Sin logo</span>
          )}
        </div>
        <label className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">
          Subir logo
          <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
        </label>
        <p className="mt-2 text-xs text-[var(--color-muted)]">JPG/PNG. Público en el menú digital.</p>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
        <h2 className="text-2xl">Datos del restaurante</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nombre *" value={form.name} onChange={(v) => set("name", v)} required />
          <Field label="Teléfono" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
          <Field label="Ciudad" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="Dirección" value={form.address} onChange={(v) => set("address", v)} className="sm:col-span-2" />
          <Field label="Horario" value={form.schedule} onChange={(v) => set("schedule", v)} placeholder="Lun–Dom 12:00–22:00" className="sm:col-span-2" />
        </div>
        {err ? <p className="mt-3 text-sm text-[var(--color-wine)]">{err}</p> : null}
        {msg ? <p className="mt-3 text-sm text-[var(--color-sage)]">{msg}</p> : null}
        <button type="submit" disabled={loading} className="mt-5 h-12 rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)] disabled:opacity-60">
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, className = "", ...rest }) {
  return (
    <label className={`block text-sm font-semibold ${className}`}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal"
        {...rest}
      />
    </label>
  );
}
