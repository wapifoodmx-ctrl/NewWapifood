/** Todos los módulos del panel owner — no se ocultan de la navegación. */
export const MODULES = [
  { id: "dashboard", title: "Panel", href: "/dashboard", group: "setup" },
  { id: "config", title: "Restaurante", href: "/config", group: "setup" },
  { id: "carta", title: "Carta", href: "/carta", group: "setup" },
  { id: "insumos", title: "Insumos", href: "/insumos", group: "setup" },
  { id: "recetas", title: "Recetas", href: "/recetas", group: "setup" },
  { id: "mesas", title: "Mesas", href: "/mesas", group: "setup" },
  { id: "meseros", title: "Meseros", href: "/meseros", group: "setup" },
  { id: "pos", title: "Punto de venta", href: "/pos", group: "ops" },
  { id: "kitchen", title: "Cocina", href: "/cocina", group: "ops" },
  { id: "tickets", title: "Tickets", href: "/tickets", group: "ops" },
  { id: "pantallas", title: "Pantallas", href: "/pantallas", group: "ops" },
  { id: "menu-cliente", title: "Menú QR", href: "/menu", group: "ops" },
  { id: "kiosko", title: "Kiosko", href: "/kiosko", group: "ops" },
  { id: "pagos", title: "Pagos / plan", href: "/pagos", group: "setup" },
  { id: "equipo", title: "Equipo", href: "/equipo", group: "setup" },
];

export function modulesForMode() {
  return MODULES;
}
