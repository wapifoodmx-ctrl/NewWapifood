/** Estados de ORDEN (New alineado a semántica Front) */
export const ORDER_STATUS = {
  pendiente: {
    label: "Por confirmar",
    detail: "Pedido web o a domicilio. Falta que el local lo acepte.",
    color: "bg-[var(--chip-warn-bg)] text-[var(--chip-warn-fg)]",
    banner: "bg-[var(--color-primary-solid)] text-[var(--color-on-solid)]",
  },
  abierta: {
    label: "En mesa",
    detail: "La cuenta está abierta.",
    color: "bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]",
    banner: "bg-[var(--ink)] text-[var(--bg)]",
  },
  cocina: {
    label: "En cocina",
    detail: "Hay platillos pendientes de preparar.",
    color: "bg-[var(--chip-warn-bg)] text-[var(--chip-warn-fg)]",
    banner: "bg-[var(--color-primary-solid)] text-[var(--color-on-solid)]",
  },
  lista: {
    label: "Preparado",
    detail: "Los platillos activos ya están listos.",
    color: "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-fg)]",
    banner: "bg-[var(--color-sage-solid)] text-[var(--color-on-tone)]",
  },
  entregada: {
    label: "Entregada",
    detail: "Ya se entregó. Lista para cobrar.",
    color: "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-fg)]",
    banner: "bg-[var(--color-sage-solid)] text-[var(--color-on-tone)]",
  },
  pagada: {
    label: "Pagada",
    detail: "Cuenta cobrada y cerrada.",
    color: "bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]",
    banner: "bg-[var(--ink)] text-[var(--bg)]",
  },
  cancelada: {
    label: "Cancelada",
    detail: "La orden se canceló.",
    color: "bg-[var(--chip-bad-bg)] text-[var(--chip-bad-fg)]",
    banner: "bg-[var(--color-wine-solid)] text-[var(--color-on-tone)]",
  },
};

/** Estados de ÍTEM (paridad Front updateProductStatus) */
export const ITEM_STATUS = {
  pendiente: { label: "Pendiente", color: "text-[var(--color-espresso)]" },
  preparado: { label: "Preparado", color: "text-[var(--color-sage)]" },
  cancelado: { label: "Cancelado", color: "text-[var(--color-wine)] line-through" },
};

export function statusMeta(status) {
  return (
    ORDER_STATUS[status] || {
      label: status || "—",
      detail: "",
      color: "bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]",
      banner: "bg-[var(--ink)] text-[var(--bg)]",
    }
  );
}

export function itemStatusMeta(status) {
  return ITEM_STATUS[status] || ITEM_STATUS.pendiente;
}

export function waitMeta(openedAt, now = Date.now()) {
  if (!openedAt) return { mins: 0, label: "Sin hora", tone: "ok" };
  const mins = Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60000));
  if (mins >= 20) return { mins, label: `${mins} min · muy tarde`, tone: "late" };
  if (mins >= 10) return { mins, label: `${mins} min · tardando`, tone: "mid" };
  return { mins, label: mins === 1 ? "1 min" : `${mins} min`, tone: "ok" };
}
