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
    confirmation_code: profile?.confirmation_code || "",
    require_confirm_code: profile?.require_confirm_code !== false,
    delivery_enabled: !!profile?.delivery_enabled,
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
      setMsg("Logo subido. Guarda los cambios.");
    } catch (e2) {
      setErr(e2.message || "No se pudo subir el logo");
    } finally {
      setLoading(false);
    }
  }

  function regenCode() {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    set("confirmation_code", code);
  }

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!form.name.trim() || form.name.trim().length < 2) {
      setErr("El nombre del restaurante debe tener al menos 2 caracteres.");
      return;
    }
    if (form.require_confirm_code && (!form.confirmation_code || form.confirmation_code.length < 4)) {
      setErr("El código de confirmación debe tener al menos 4 dígitos.");
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
        confirmation_code: form.confirmation_code || null,
        require_confirm_code: form.require_confirm_code,
        delivery_enabled: form.delivery_enabled,
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
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
        <h2 className="text-2xl">Datos del restaurante</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nombre *" value={form.name} onChange={(v) => set("name", v)} required />
          <Field label="Teléfono" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
          <Field label="Ciudad" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="Dirección" value={form.address} onChange={(v) => set("address", v)} className="sm:col-span-2" />
          <Field label="Horario" value={form.schedule} onChange={(v) => set("schedule", v)} className="sm:col-span-2" />
        </div>

        <div className="mt-6 rounded-xl bg-[var(--color-cream)] p-4">
          <h3 className="font-semibold">Pedidos del menú digital</h3>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.require_confirm_code} onChange={(e) => set("require_confirm_code", e.target.checked)} />
            Pedir código de confirmación al cliente
          </label>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block flex-1 text-sm font-semibold">
              Código
              <input
                value={form.confirmation_code}
                onChange={(e) => set("confirmation_code", e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3 font-normal tracking-[0.2em]"
              />
            </label>
            <button type="button" onClick={regenCode} className="h-11 rounded-full bg-[var(--color-paper)] px-4 text-sm font-semibold">
              Generar
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.delivery_enabled} onChange={(e) => set("delivery_enabled", e.target.checked)} />
            Delivery activo (aviso en menú público)
          </label>
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
