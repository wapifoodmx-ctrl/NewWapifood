/** Todas las pantallas siguen en el menú. Los títulos están en español llano. */
export const MODULES = [
  { id: "dashboard", title: "Inicio", href: "/dashboard", group: "ops", nav: "hoy", icon: "home", hint: "Cómo va el día" },
  { id: "pos", title: "Caja", href: "/pos", group: "ops", nav: "hoy", icon: "register", hint: "Pedidos y cobro" },
  { id: "kitchen", title: "Cocina", href: "/cocina", group: "ops", nav: "hoy", icon: "flame", hint: "Comandas en vivo" },
  { id: "tickets", title: "Cuentas", href: "/tickets", group: "ops", nav: "hoy", icon: "receipt", hint: "Ver e imprimir" },
  { id: "mesas", title: "Mesas", href: "/mesas", group: "setup", nav: "piso", icon: "table", hint: "Mapa del salón" },
  { id: "meseros", title: "Meseros", href: "/meseros", group: "setup", nav: "piso", icon: "users", hint: "Códigos y mesas" },
  { id: "kiosko", title: "Kiosko", href: "/kiosko", group: "ops", nav: "piso", icon: "tablet", hint: "Pedido en el local" },
  { id: "menu-cliente", title: "Menú para clientes", href: "/menu", group: "ops", nav: "piso", icon: "qr", hint: "QR y domicilio" },
  { id: "pantallas", title: "Pantallas", href: "/pantallas", group: "ops", nav: "piso", icon: "screen", hint: "Cocina en una pantalla" },
  { id: "carta", title: "Platillos", href: "/carta", group: "setup", nav: "carta", icon: "dish", hint: "Precios y fotos" },
  { id: "insumos", title: "Insumos", href: "/insumos", group: "setup", nav: "carta", icon: "box", hint: "Lo que hay en bodega" },
  { id: "recetas", title: "Recetas", href: "/recetas", group: "setup", nav: "carta", icon: "book", hint: "Qué lleva cada platillo" },
  { id: "listas", title: "Listas", href: "/listas", group: "setup", nav: "carta", icon: "list", hint: "Grupos de productos" },
  { id: "importar", title: "Importar", href: "/importar", group: "setup", nav: "carta", icon: "upload", hint: "Subir un archivo" },
  { id: "empezar", title: "Primeros pasos", href: "/empezar", group: "setup", nav: "cuenta", icon: "steps", hint: "Hasta la primera venta" },
  { id: "config", title: "Datos del local", href: "/config", group: "setup", nav: "cuenta", icon: "store", hint: "Nombre, teléfono y logo" },
  { id: "equipo", title: "Equipo", href: "/equipo", group: "setup", nav: "cuenta", icon: "team", hint: "Quién puede entrar" },
  { id: "pagos", title: "Plan", href: "/pagos", group: "setup", nav: "cuenta", icon: "card", hint: "Pagar con Mercado Pago" },
  { id: "masa", title: "Masa", href: "/masa", group: "ops", nav: "cuenta", icon: "bread", hint: "Producción de masa" },
];

export const NAV_GROUPS = [
  { id: "hoy", label: "Hoy" },
  { id: "piso", label: "En el piso" },
  { id: "carta", label: "Tu carta" },
  { id: "cuenta", label: "Tu negocio" },
];

/** Secciones del menú de escritorio, por tarea. */
export const NAV_SECTIONS = [
  { id: "hoy", label: "Hoy", icon: "home", items: ["tickets", "empezar"] },
  { id: "vender", label: "Vender", icon: "register", items: ["pos", "kiosko", "menu-cliente"] },
  { id: "piso", label: "Cocina y piso", icon: "flame", items: ["kitchen", "mesas", "meseros", "pantallas"] },
  { id: "carta", label: "Tu carta e inventario", icon: "dish", items: ["carta", "insumos", "recetas", "listas"] },
  { id: "reportes", label: "Reportes", icon: "chart", items: ["dashboard"] },
  { id: "negocio", label: "Tu negocio", icon: "store", items: ["equipo", "config", "pagos"] },
];

const PINS = {
  owner: ["pos", "kitchen", "mesas", "tickets", "carta"],
  admin: ["pos", "kitchen", "mesas", "tickets", "carta"],
  piso: ["pos", "mesas", "kitchen", "tickets"],
  cocina: ["kitchen", "tickets", "pantallas", "dashboard"],
};

/** Lo que el rol ve en las secciones. El resto sigue en Más y en la búsqueda. */
const ROLE_MAIN = {
  owner: null,
  admin: null,
  piso: ["dashboard", "pos", "kitchen", "tickets", "mesas", "meseros", "kiosko", "menu-cliente", "pantallas"],
  cocina: ["dashboard", "kitchen", "tickets", "pantallas"],
};

const MORE = {
  owner: ["importar", "masa"],
  admin: ["importar", "masa"],
};

const REPORT_TITLE = { dashboard: "Ventas y alertas" };

function moduleById(id) {
  return MODULES.find((item) => item.id === id);
}

function roleKey(role) {
  return PINS[role] ? role : "owner";
}

export function navModel(role) {
  const key = roleKey(role);
  const pins = PINS[key].map(moduleById).filter(Boolean);
  const pinIds = new Set(pins.map((item) => item.id));
  const mainIds = ROLE_MAIN[key] ? new Set(ROLE_MAIN[key]) : null;
  const explicitMore = MORE[key];
  const moreIds = new Set(
    explicitMore ||
      MODULES.map((item) => item.id).filter((id) => mainIds && !mainIds.has(id) && !pinIds.has(id)),
  );
  const sections = NAV_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    items: section.items
      .map(moduleById)
      .filter((item) => item && !pinIds.has(item.id) && !moreIds.has(item.id) && (!mainIds || mainIds.has(item.id)))
      .map((item) =>
        section.id === "reportes" && REPORT_TITLE[item.id]
          ? { ...item, title: REPORT_TITLE[item.id] }
          : item,
      ),
  })).filter((section) => section.items.length);
  const more = MODULES.filter((item) => moreIds.has(item.id));
  return { pins, sections, more };
}

export function sectionForPath(role, pathname) {
  const model = navModel(role);
  const groups = [
    ...model.sections,
    ...(model.more.length ? [{ id: "mas", items: model.more }] : []),
  ];
  return groups.find((section) =>
    section.items.some((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))),
  )?.id;
}

const TILES = {
  owner: ["pos", "kitchen", "mesas", "tickets", "carta", "empezar"],
  admin: ["pos", "kitchen", "mesas", "tickets", "carta", "equipo"],
  piso: ["pos", "mesas", "kitchen", "tickets"],
  cocina: ["kitchen", "tickets", "pantallas"],
};

export function modulesForMode() {
  return MODULES;
}

export function tilesForRole(role) {
  const ids = TILES[role] || TILES.owner;
  return ids.map((id) => MODULES.find((m) => m.id === id)).filter(Boolean);
}

export function primaryModules(role) {
  const ids =
    role === "cocina"
      ? ["kitchen", "tickets", "pantallas", "dashboard"]
      : role === "piso"
        ? ["pos", "mesas", "kitchen", "tickets"]
        : ["pos", "kitchen", "mesas", "dashboard"];
  return ids.map((id) => MODULES.find((m) => m.id === id)).filter(Boolean);
}

/** Después de entrar, cada rol cae en su pantalla de trabajo. */
export function homePath(role) {
  if (role === "cocina") return "/cocina";
  if (role === "piso") return "/pos";
  return "/dashboard";
}

export function roleLabel(role) {
  return (
    {
      owner: "Dueño",
      admin: "Administración",
      piso: "Caja y piso",
      cocina: "Cocina",
    }[role] || ""
  );
}
