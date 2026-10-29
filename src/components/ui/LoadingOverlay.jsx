"use client";

export function LoadingOverlay({ visible, message = "Procesando…" }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-8 py-6 text-center shadow-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-warm-stone)] border-t-[var(--color-saffron-glow)]" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
          {message}
        </p>
      </div>
    </div>
  );
}
