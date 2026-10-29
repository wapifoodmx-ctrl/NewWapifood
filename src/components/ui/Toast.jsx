"use client";

import { useEffect, useState } from "react";

let pushToast = null;

export const toast = {
  success(message, duration = 4000) {
    pushToast?.({ type: "success", message, duration });
  },
  error(message, duration = 5000) {
    pushToast?.({ type: "error", message, duration });
  },
  warning(message, duration = 5000) {
    pushToast?.({ type: "warning", message, duration });
  },
  info(message, duration = 4000) {
    pushToast?.({ type: "info", message, duration });
  },
};

const STYLES = {
  success: "border-[var(--color-sage)] bg-[var(--color-paper)] text-[var(--color-onyx-warm)]",
  error: "border-[var(--color-wine)] bg-[var(--color-paper)] text-[var(--color-onyx-warm)]",
  warning: "border-[var(--color-saffron-glow)] bg-[var(--color-paper)] text-[var(--color-onyx-warm)]",
  info: "border-[var(--color-warm-stone)] bg-[var(--color-paper)] text-[var(--color-onyx-warm)]",
};

const DOT = {
  success: "bg-[var(--color-sage)]",
  error: "bg-[var(--color-wine)]",
  warning: "bg-[var(--color-saffron-glow)]",
  info: "bg-[var(--color-espresso)]",
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    pushToast = (t) => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev, { ...t, id }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, t.duration || 4000);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  function dismiss(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[2000] flex w-[min(100vw-2rem,360px)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 border px-4 py-3 shadow-lg ${STYLES[t.type] || STYLES.info}`}
            role="status"
          >
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[t.type] || DOT.info}`} />
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-xs font-semibold uppercase text-[var(--color-walnut)]"
            >
              Cerrar
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
