"use client";

export function AppModal({
  open,
  title,
  message,
  variant = "info",
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  const bar =
    variant === "error"
      ? "bg-[var(--color-wine)]"
      : variant === "success"
        ? "bg-[var(--color-sage)]"
        : variant === "confirm"
          ? "bg-[var(--color-saffron-glow)]"
          : "bg-[var(--color-onyx-warm)]";

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
      <div role="dialog" aria-modal="true" className="w-full max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] shadow-2xl">
        <div className={`h-1 w-full ${bar}`} />
        <div className="p-6">
          {title ? <h2 className="text-2xl font-normal">{title}</h2> : null}
          {message ? (
            <p className={`text-sm text-[var(--color-espresso)] ${title ? "mt-2" : ""}`}>{message}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {variant === "confirm" ? (
              <button type="button" onClick={onClose} className="h-11 rounded-[3px] border border-[var(--color-warm-stone)] px-4 text-xs font-semibold uppercase">
                {cancelLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onConfirm?.();
                if (variant !== "confirm") onClose?.();
              }}
              className="h-11 rounded-[3px] bg-[var(--color-onyx-warm)] px-4 text-xs font-semibold uppercase text-[var(--color-parchment)]"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
