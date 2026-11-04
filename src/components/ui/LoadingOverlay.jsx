"use client";

export function LoadingOverlay({ visible, message = "Procesando…" }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="card px-8 py-6 text-center" role="status">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary-solid)]" />
        <p className="mt-4 text-base font-bold text-[var(--ink)]">{message}</p>
      </div>
    </div>
  );
}
