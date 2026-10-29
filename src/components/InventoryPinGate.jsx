"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

const KEY = "wapifood_inv_unlock";

export function useInventoryUnlock(restaurantId, hasPin) {
  const [unlocked, setUnlocked] = useState(!hasPin);

  useEffect(() => {
    if (!hasPin) {
      setUnlocked(true);
      return;
    }
    try {
      setUnlocked(sessionStorage.getItem(KEY) === restaurantId);
    } catch {
      setUnlocked(false);
    }
  }, [restaurantId, hasPin]);

  function lock() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setUnlocked(false);
  }

  function unlockOk() {
    try {
      sessionStorage.setItem(KEY, restaurantId);
    } catch {
      /* ignore */
    }
    setUnlocked(true);
  }

  return { unlocked, lock, unlockOk };
}

export function InventoryPinGate({ restaurantId, hasPin, inventoryPin, unlocked, unlockOk, children }) {
  const [pin, setPin] = useState("");

  if (!hasPin || unlocked) return children;

  function submit(e) {
    e.preventDefault();
    if (String(pin) === String(inventoryPin)) {
      unlockOk();
      toast.success("Inventario desbloqueado");
      setPin("");
      return;
    }
    toast.error("PIN incorrecto");
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-sm border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-saffron-glow)]">
          Seguridad
        </p>
        <h2 className="mt-2 text-2xl font-normal">PIN de inventario</h2>
        <p className="mt-2 text-sm text-[var(--color-espresso)]">
          Este restaurante protege entradas y mermas con un PIN (como en WapifoodFront).
        </p>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          className="mt-4 h-12 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] text-center text-2xl tracking-[0.3em]"
          inputMode="numeric"
          autoFocus
        />
        <button type="submit" className="mt-4 h-11 w-full rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]">
          Desbloquear
        </button>
      </form>
    </div>
  );
}

export function InventoryPinSettings({ restaurantId, initialPin }) {
  const [pin, setPin] = useState(initialPin || "");
  const [loading, setLoading] = useState(false);

  async function save(e) {
    e.preventDefault();
    const clean = pin.replace(/\D/g, "").slice(0, 8);
    if (clean && (clean.length < 4 || clean.length > 8)) {
      toast.error("El PIN debe tener entre 4 y 8 dígitos, o vacío para desactivar.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurant_profiles")
      .upsert({ restaurant_id: restaurantId, inventory_pin: clean || null });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(clean ? "PIN de inventario guardado" : "PIN desactivado");
  }

  return (
    <form onSubmit={save} className="max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5">
      <h2 className="text-xl font-normal">PIN de inventario</h2>
      <p className="mt-1 text-sm text-[var(--color-espresso)]">
        Si lo configuras, habrá que desbloquear el módulo en cada sesión del navegador.
      </p>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="4–8 dígitos o vacío"
        className="mt-3 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 tracking-[0.2em]"
        inputMode="numeric"
      />
      <button
        type="submit"
        disabled={loading}
        className="mt-3 h-11 rounded-[3px] bg-[var(--color-onyx-warm)] px-5 text-xs font-semibold uppercase text-[var(--color-parchment)] disabled:opacity-60"
      >
        Guardar PIN
      </button>
    </form>
  );
}
