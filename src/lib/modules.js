import { SETUP_MODULE_IDS, OPERATIONAL_MODULE_IDS } from "@/lib/planMode";

export const MODULES = [
  { id: "dashboard", title: "Panel", href: "/dashboard", group: "setup" },
  { id: "config", title: "Restaurante", href: "/config", group: "setup" },
  { id: "carta", title: "Carta", href: "/carta", group: "setup" },
  { id: "insumos", title: "Insumos", href: "/insumos", group: "setup" },
  { id: "recetas", title: "Recetas", href: "/recetas", group: "setup" },
  { id: "mesas", title: "Mesas", href: "/mesas", group: "setup" },
  { id: "meseros", title: "Meseros (alta)", href: "/meseros", group: "setup" },
  { id: "pos", title: "Punto de venta", href: "/pos", group: "ops" },
  { id: "kitchen", title: "Cocina", href: "/cocina", group: "ops" },
  { id: "tickets", title: "Tickets", href: "/tickets", group: "ops" },
  { id: "pantallas", title: "Pantallas", href: "/pantallas", group: "ops" },
  { id: "menu-cliente", title: "Menú QR", href: "/menu", group: "ops" },
  { id: "kiosko", title: "Kiosko", href: "/kiosko", group: "ops" },
  { id: "pagos", title: "Pagos / plan", href: "/pagos", group: "setup" },
  { id: "equipo", title: "Equipo", href: "/equipo", group: "setup" },
];

export function modulesForMode(operational) {
  if (operational) return MODULES;
  return MODULES.filter(
    (m) => SETUP_MODULE_IDS.has(m.id) || m.id === "pagos" || m.id === "dashboard",
  );
}

export { SETUP_MODULE_IDS, OPERATIONAL_MODULE_IDS };
