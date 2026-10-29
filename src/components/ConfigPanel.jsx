"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadPublicImage } from "@/lib/storage";
import {
  formatMxPhoneDisplay,
  isValidMxPhone,
  isValidMxPostalCode,
  normalizeMxPhone,
  normalizeMxPostalCode,
} from "@/lib/mxValidators";

export function ConfigPanel({ restaurant, profile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: restaurant?.name || "",
    phone: profile?.phone ? formatMxPhoneDisplay(profile.phone) : "",
    whatsapp: profile?.whatsapp ? formatMxPhoneDisplay(profile.whatsapp) : "",
    address: profile?.address || "",
    city: profile?.city || "",
    postal_code: profile?.postal_code || "",
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

  /** Sube y guarda el logo en BD de inmediato (no depende de "Guardar cambios"). */
  async function onLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("El archivo debe ser una imagen.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("La imagen no puede superar 5 MB.");
      }
      const supabase = createClient();
      const url = await uploadPublicImage(supabase, restaurant.id, file, "logos");
      const { data: savedLogo, error } = await supabase
        .from("restaurants")
        .update({ logo_url: url })
        .eq("id", restaurant.id)
        .select("id, logo_url")
        .maybeSingle();
      if (error) throw error;
      if (!savedLogo) {
        throw new Error(
          "El logo se subió al storage pero no se pudo guardar en el restaurante (permisos). Ejecuta SQL 018_fix_restaurants_rls.sql",
        );
      }
      set("logo_url", savedLogo.logo_url || url);
      setMsg("Logo actualizado y guardado.");
      router.refresh();
    } catch (e2) {
      setErr(e2.message || "No se pudo subir el logo");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function regenCode() {
    set("confirmation_code", String(Math.floor(1000 + Math.random() * 9000)));
  }

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    const name = form.name.trim();
    if (name.length < 2) {
      setErr("El nombre del restaurante debe tener al menos 2 caracteres.");
      return;
    }
    if (form.phone && !isValidMxPhone(form.phone)) {
      setErr("Teléfono inválido. Usa 10 dígitos de México (ej. 55 1234 5678).");
      return;
    }
    if (form.whatsapp && !isValidMxPhone(form.whatsapp)) {
      setErr("WhatsApp inválido. Usa 10 dígitos de México.");
      return;
    }
    if (form.postal_code && !isValidMxPostalCode(form.postal_code)) {
      setErr("Código postal inválido. Debe tener 5 dígitos.");
      return;
    }
    if (form.require_confirm_code && (!form.confirmation_code || form.confirmation_code.length < 4)) {
      setErr("El código de confirmación debe tener al menos 4 dígitos.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    try {
      const { data: savedRest, error: e1 } = await supabase
        .from("restaurants")
        .update({
          name,
          logo_url: form.logo_url || null,
        })
        .eq("id", restaurant.id)
        .select("id, name, logo_url")
        .maybeSingle();
      if (e1) throw e1;
      if (!savedRest) {
        throw new Error(
          "No se pudo actualizar el restaurante (nombre/logo). Ejecuta en Supabase el SQL 018_fix_restaurants_rls.sql",
        );
      }
      set("name", savedRest.name || name);
      if (savedRest.logo_url) set("logo_url", savedRest.logo_url);

      const { error: e2 } = await supabase.from("restaurant_profiles").upsert({
        restaurant_id: restaurant.id,
        phone: form.phone ? normalizeMxPhone(form.phone) : null,
        whatsapp: form.whatsapp ? normalizeMxPhone(form.whatsapp) : null,
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        postal_code: form.postal_code ? normalizeMxPostalCode(form.postal_code) : null,
        schedule: form.schedule?.trim() || null,
        confirmation_code: form.confirmation_code || null,
        require_confirm_code: form.require_confirm_code,
        delivery_enabled: form.delivery_enabled,
      });
      if (e2) throw e2;

      setMsg("Cambios guardados.");
      router.refresh();
    } catch (e3) {
      setErr(e3.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSave} className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4 text-center">
        <div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden border border-[var(--color-warm-stone)] bg-[var(--color-parchment)]">
          {form.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo_url} alt="Logo del restaurante" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-[var(--color-walnut)]">Sin logo</span>
          )}
        </div>
        <label className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-[3px] bg-[var(--color-parchment)] px-4 text-xs font-semibold uppercase tracking-wide">
          {loading ? "Subiendo…" : "Subir logo"}
          <input type="file" accept="image/*" className="hidden" onChange={onLogo} disabled={loading} />
        </label>
        <p className="mt-2 text-[11px] text-[var(--color-walnut)]">JPG, PNG o WebP · máx. 5 MB. Se guarda al subir.</p>
      </div>

      <div className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5">
        <h2 className="text-2xl font-normal">Datos del restaurante</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="Nombre *"
            value={form.name}
            onChange={(v) => set("name", v)}
            required
            minLength={2}
          />
          <Field
            label="Teléfono (10 dígitos)"
            value={form.phone}
            onChange={(v) => set("phone", formatMxPhoneDisplay(v))}
            inputMode="numeric"
            placeholder="55 1234 5678"
            autoComplete="tel-national"
          />
          <Field
            label="WhatsApp (10 dígitos)"
            value={form.whatsapp}
            onChange={(v) => set("whatsapp", formatMxPhoneDisplay(v))}
            inputMode="numeric"
            placeholder="55 1234 5678"
          />
          <Field
            label="Código postal"
            value={form.postal_code}
            onChange={(v) => set("postal_code", normalizeMxPostalCode(v))}
            inputMode="numeric"
            placeholder="06600"
            maxLength={5}
          />
          <Field label="Ciudad" value={form.city} onChange={(v) => set("city", v)} />
          <Field
            label="Dirección"
            value={form.address}
            onChange={(v) => set("address", v)}
            className="sm:col-span-2"
          />
          <Field
            label="Horario"
            value={form.schedule}
            onChange={(v) => set("schedule", v)}
            className="sm:col-span-2"
            placeholder="Lun–Dom 9:00–22:00"
          />
        </div>

        <div className="mt-6 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide">Pedidos del menú digital</h3>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.require_confirm_code}
              onChange={(e) => set("require_confirm_code", e.target.checked)}
            />
            Pedir código de confirmación al cliente
          </label>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block flex-1 text-sm font-semibold">
              Código
              <input
                value={form.confirmation_code}
                onChange={(e) =>
                  set("confirmation_code", e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-3 tracking-[0.2em]"
              />
            </label>
            <button
              type="button"
              onClick={regenCode}
              className="h-11 rounded-[3px] bg-[var(--color-paper)] px-4 text-xs font-semibold uppercase"
            >
              Generar
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.delivery_enabled}
              onChange={(e) => set("delivery_enabled", e.target.checked)}
            />
            Delivery activo (pedidos a domicilio en menú público)
          </label>
        </div>

        {err ? <p className="mt-3 text-sm text-[var(--color-wine)]">{err}</p> : null}
        {msg ? <p className="mt-3 text-sm text-[var(--color-sage)]">{msg}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 h-12 rounded-[3px] bg-[var(--color-onyx-warm)] px-6 text-xs font-semibold uppercase tracking-wide text-[var(--color-parchment)] disabled:opacity-60"
        >
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
        className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal"
        {...rest}
      />
    </label>
  );
}
