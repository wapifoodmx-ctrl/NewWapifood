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
      <div role="dialog" aria-modal="true" aria-labelledby="app-modal-title" className="card w-full max-w-md overflow-hidden">
        <div className={`h-1.5 w-full ${bar}`} />
        <div className="p-6">
          {title ? <h2 id="app-modal-title" className="text-2xl">{title}</h2> : null}
          {message ? (
            <p className={`text-base text-[var(--ink-soft)] ${title ? "mt-2" : ""}`}>{message}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {variant === "confirm" ? (
              <button type="button" onClick={onClose} className="btn-ghost px-4">
                {cancelLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onConfirm?.();
                if (variant !== "confirm") onClose?.();
              }}
              className="btn-primary px-4"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
