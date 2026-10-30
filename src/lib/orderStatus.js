/** Estados de ORDEN (New alineado a semántica Front) */
export const ORDER_STATUS = {
  pendiente: {
    label: "Por confirmar",
    detail: "Encargo web/domicilio pendiente de confirmar",
    color: "bg-[var(--color-walnut)]",
  },
  abierta: {
    label: "En mesa",
    detail: "Cuenta abierta (aún no enviada o en piso)",
    color: "bg-[var(--color-espresso)]",
  },
  cocina: {
    label: "En cocina",
    detail: "Hay productos pendientes de preparar",
    color: "bg-[var(--color-saffron-glow)]",
  },
  lista: {
    label: "Preparado",
    detail: "Todos los productos activos están preparados (Front: comanda completed)",
    color: "bg-[var(--color-sage)]",
  },
  entregada: {
    label: "Entregada",
    detail: "Entregada en mesa / lista para cobro",
    color: "bg-[var(--color-sage)]",
  },
  pagada: {
    label: "Finalizado",
    detail: "Cobrada / cerrada (Front: Finalizado)",
    color: "bg-[var(--color-onyx-warm)]",
  },
  cancelada: {
    label: "Cancelado",
    detail: "Orden cancelada",
    color: "bg-[var(--color-wine)]",
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
      color: "bg-[var(--color-walnut)]",
    }
  );
}

export function itemStatusMeta(status) {
  return ITEM_STATUS[status] || ITEM_STATUS.pendiente;
}
