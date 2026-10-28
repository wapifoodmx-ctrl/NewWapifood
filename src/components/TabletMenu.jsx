"use client";

import { useEffect, useState } from "react";
import { DigitalMenu } from "@/components/DigitalMenu";

const UNLOCK_KEY = "wapifood_tablet_unlock";

/**
 * Tablet de mesa: PIN opcional + menú fijo a esa mesa (source=tablet).
 */
export function TabletMenu({
  restaurant,
  theme,
  products,
  categories,
  table,
  profile,
  canOperate,
}) {
  const [unlocked, setUnlocked] = useState(!table.access_pin);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!table.access_pin) return;
    try {
      const raw = sessionStorage.getItem(UNLOCK_KEY);
      if (raw === table.id) setUnlocked(true);
    } catch {
      /* ignore */
    }
  }, [table.id, table.access_pin]);

  function unlock(e) {
    e.preventDefault();
    setErr("");
    if (String(pin) !== String(table.access_pin)) {
      setErr("PIN incorrecto");
      return;
    }
    try {
      sessionStorage.setItem(UNLOCK_KEY, table.id);
    } catch {
      /* ignore */
    }
    setUnlocked(true);
  }

  if (!canOperate) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-parchment)] px-4">
        <div className="max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8 text-center">
          <h1 className="text-3xl font-normal">Tablet inactiva</h1>
          <p className="mt-2 text-[var(--color-espresso)]">El restaurante necesita un plan activo.</p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-parchment)] px-4">
        <form
          onSubmit={unlock}
          className="w-full max-w-sm border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-saffron-glow)]">
            Tablet de mesa
          </p>
          <h1 className="mt-2 text-4xl font-normal">Mesa {table.number}</h1>
          <p className="mt-2 text-sm text-[var(--color-espresso)]">{restaurant.name}</p>
          <label className="wf-label mt-6">
            PIN de la tablet
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="wf-input mt-2 text-center text-2xl tracking-[0.3em]"
              inputMode="numeric"
              autoFocus
            />
          </label>
          {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
          <button type="submit" className="wf-btn wf-btn-primary mt-5 w-full">
            Desbloquear
          </button>
        </form>
      </div>
    );
  }

  return (
    <DigitalMenu
      restaurant={restaurant}
      theme={theme}
      products={products}
      categories={categories}
      tables={[table]}
      mode="kiosk"
      requireConfirmCode={false}
      deliveryEnabled={!!profile?.delivery_enabled}
      orderSource="tablet"
      fixedTableId={table.id}
    />
  );
}
