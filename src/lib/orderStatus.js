export const ORDER_STATUS = {
  pendiente: {
    label: "Por confirmar",
    detail: "El restaurante debe confirmar tu pedido",
    color: "bg-[var(--color-walnut)]",
  },
  abierta: {
    label: "En mesa",
    detail: "Cuenta abierta en piso",
    color: "bg-[var(--color-espresso)]",
  },
  cocina: {
    label: "Preparando",
    detail: "Tu pedido se está preparando",
    color: "bg-[var(--color-saffron-glow)]",
  },
  lista: {
    label: "Lista",
    detail: "¡Listo! Ya puedes pasar o te lo llevan",
    color: "bg-[var(--color-sage)]",
  },
  entregada: {
    label: "Entregada",
    detail: "Pedido entregado en mesa",
    color: "bg-[var(--color-sage)]",
  },
  pagada: {
    label: "Pagada",
    detail: "Cuenta cerrada",
    color: "bg-[var(--color-onyx-warm)]",
  },
  cancelada: {
    label: "Cancelada",
    detail: "Este pedido fue cancelado",
    color: "bg-[var(--color-wine)]",
  },
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
