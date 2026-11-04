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
