"use client";

let resolver = null;
let setter = null;

export function registerConfirmHost(setState) {
  setter = setState;
  return () => {
    setter = null;
  };
}

export function confirmAsync(message, { title = "Confirmar", confirmLabel = "Sí", cancelLabel = "No" } = {}) {
  return new Promise((resolve) => {
    if (!setter) {
      resolve(window.confirm(message));
      return;
    }
    resolver = resolve;
    setter({
      open: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
    });
  });
}

export function resolveConfirm(value) {
  resolver?.(value);
  resolver = null;
  setter?.({ open: false, title: "", message: "", confirmLabel: "Sí", cancelLabel: "No" });
}
