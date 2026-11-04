"use client";

import { useEffect, useState } from "react";

let pushToast = null;

function normalize(message, extra, fallback) {
  if (extra && typeof extra === "object") {
    return { message, duration: extra.duration || fallback, action: extra.action || null };
  }
  return { message, duration: typeof extra === "number" ? extra : fallback, action: null };
}

export const toast = {
  success(message, extra) {
    pushToast?.({ type: "success", ...normalize(message, extra, 4000) });
  },
  error(message, extra) {
    pushToast?.({ type: "error", ...normalize(message, extra, 6500) });
  },
  warning(message, extra) {
    pushToast?.({ type: "warning", ...normalize(message, extra, 6000) });
  },
  info(message, extra) {
    pushToast?.({ type: "info", ...normalize(message, extra, 3200) });
  },
};

const STYLES = {
  success: "border-[var(--chip-ok-fg)] bg-[var(--chip-ok-bg)] text-[var(--chip-ok-fg)]",
  error: "border-[var(--chip-bad-fg)] bg-[var(--chip-bad-bg)] text-[var(--chip-bad-fg)]",
  warning: "border-[var(--chip-warn-fg)] bg-[var(--chip-warn-bg)] text-[var(--chip-warn-fg)]",
  info: "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]",
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    pushToast = (t) => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
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
      <div className="pointer-events-none fixed left-1/2 top-4 z-[2000] flex w-[min(100vw-1.5rem,440px)] -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${STYLES[t.type] || STYLES.info}`}
            role="status"
          >
            <p className="flex-1 text-base leading-snug">{t.message}</p>
            {t.action ? (
              <button
                type="button"
                className="min-h-11 shrink-0 underline"
                onClick={() => {
                  t.action.onClick?.();
                  dismiss(t.id);
                }}
              >
                {t.action.label || "Deshacer"}
              </button>
            ) : null}
            <button type="button" onClick={() => dismiss(t.id)} className="min-h-11 shrink-0 font-bold">
              Cerrar
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
