/** Todas las pantallas siguen en el menú. Los títulos están en español llano. */
export const MODULES = [
  { id: "dashboard", title: "Inicio", href: "/dashboard", group: "setup", nav: "hoy" },
  { id: "pos", title: "Caja", href: "/pos", group: "ops", nav: "hoy" },
  { id: "kitchen", title: "Cocina", href: "/cocina", group: "ops", nav: "hoy" },
  { id: "tickets", title: "Cuentas", href: "/tickets", group: "ops", nav: "hoy" },
  { id: "mesas", title: "Mesas", href: "/mesas", group: "setup", nav: "piso" },
  { id: "meseros", title: "Meseros", href: "/meseros", group: "setup", nav: "piso" },
  { id: "kiosko", title: "Kiosko", href: "/kiosko", group: "ops", nav: "piso" },
  { id: "menu-cliente", title: "Menú para clientes", href: "/menu", group: "ops", nav: "piso" },
  { id: "pantallas", title: "Pantallas", href: "/pantallas", group: "ops", nav: "piso" },
  { id: "carta", title: "Platillos", href: "/carta", group: "setup", nav: "carta" },
  { id: "insumos", title: "Insumos", href: "/insumos", group: "setup", nav: "carta" },
  { id: "recetas", title: "Recetas", href: "/recetas", group: "setup", nav: "carta" },
  { id: "listas", title: "Listas", href: "/listas", group: "setup", nav: "carta" },
  { id: "importar", title: "Importar", href: "/importar", group: "setup", nav: "carta" },
  { id: "empezar", title: "Primeros pasos", href: "/empezar", group: "setup", nav: "cuenta" },
  { id: "config", title: "Datos del local", href: "/config", group: "setup", nav: "cuenta" },
  { id: "equipo", title: "Equipo", href: "/equipo", group: "setup", nav: "cuenta" },
  { id: "pagos", title: "Plan", href: "/pagos", group: "setup", nav: "cuenta" },
  { id: "masa", title: "Masa", href: "/masa", group: "ops", nav: "cuenta" },
];

export const NAV_GROUPS = [
  { id: "hoy", label: "Hoy" },
  { id: "piso", label: "En el piso" },
  { id: "carta", label: "Tu carta" },
  { id: "cuenta", label: "Tu negocio" },
];

const PRIMARY_BY_ROLE = {
  cocina: ["kitchen", "tickets", "pantallas", "dashboard"],
  piso: ["pos", "mesas", "kitchen", "tickets"],
};

export function modulesForMode() {
  return MODULES;
}

export function primaryModules(role) {
  const ids = PRIMARY_BY_ROLE[role] || ["pos", "kitchen", "tickets", "dashboard"];
  return ids.map((id) => MODULES.find((m) => m.id === id)).filter(Boolean);
}
