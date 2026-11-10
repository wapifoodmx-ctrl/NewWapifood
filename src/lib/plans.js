// Planes del SaaS. Un solo restaurante (single) y multi-restaurante (cadena).
// Los ids se mantienen para no romper suscripciones existentes; solo cambian
// título, precio, mesas, meseros y cantidad de locales.
export const PLANS = [
  // --- Un solo restaurante ---
  {
    id: "ventas",
    title: "Plan Esencial",
    subtitle: "Para empezar a vender",
    monthly: 300,
    yearly: 3000, // 10 meses: ahorra 2
    mesas: 5,
    meseros: 3,
    restaurants: 1,
    multi: false,
    popular: false,
    features: [
      "Punto de venta completo",
      "Dashboard y reportes",
      "Menú digital con QR",
      "Tickets digitales",
      "Gestión de cocina",
      "Control de inventario",
      "Hasta 3 meseros",
    ],
  },
  {
    id: "restaurante",
    title: "Plan Profesional",
    subtitle: "Ideal para restaurantes",
    monthly: 500,
    yearly: 5000,
    mesas: 15,
    meseros: 7,
    restaurants: 1,
    multi: false,
    popular: true,
    features: [
      "Todo lo del Plan Esencial",
      "Más mesas y meseros",
      "Menú digital con QR",
      "Tickets digitales",
      "Cocina en tiempo real",
      "Inventario y recetas",
      "Hasta 7 meseros",
    ],
  },
  {
    id: "plus",
    title: "Plan Empresarial",
    subtitle: "Para operación intensa",
    monthly: 800,
    yearly: 8000,
    mesas: 25,
    meseros: 15,
    restaurants: 1,
    multi: false,
    popular: false,
    features: [
      "Todo lo del Plan Profesional",
      "Hasta 25 mesas",
      "Hasta 15 meseros",
      "Prioridad en soporte",
      "Menú digital y kiosko",
      "Inventario avanzado",
      "Reportes ampliados",
    ],
  },
  // --- Multi-restaurante (cadena) ---
  {
    id: "ventas_multi",
    title: "Plan Cadena",
    subtitle: "Varios locales, un solo control",
    monthly: 500,
    yearly: 5000,
    mesas: 5,
    meseros: 3,
    restaurants: 3,
    multi: true,
    popular: false,
    features: [
      "Todo lo del Plan Esencial",
      "Hasta 3 restaurantes",
      "Panel centralizado",
      "Reportes por local",
      "Hasta 3 meseros por local",
    ],
  },
  {
    id: "restaurante_multi",
    title: "Plan Franquicia",
    subtitle: "Para cadenas en crecimiento",
    monthly: 800,
    yearly: 8000,
    mesas: 15,
    meseros: 7,
    restaurants: 5,
    multi: true,
    popular: true,
    features: [
      "Todo lo del Plan Profesional",
      "Hasta 5 restaurantes",
      "Panel centralizado",
      "Reportes consolidados",
      "Hasta 7 meseros por local",
    ],
  },
  {
    id: "plus_multi",
    title: "Plan Corporativo",
    subtitle: "Operación a escala",
    monthly: 1000,
    yearly: 10000,
    mesas: 25,
    meseros: 15,
    restaurants: 8,
    multi: true,
    popular: false,
    features: [
      "Todo lo del Plan Empresarial",
      "Hasta 8 restaurantes",
      "Panel centralizado",
      "Reportes consolidados",
      "Soporte prioritario",
    ],
  },
];

export function planMeta(id) {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

// Nivel del plan: 'basic' (Ventas/Esencial), 'pro' (Restaurante/Profesional), 'enterprise' (Plus/Empresarial).
export function planTier(id) {
  const p = (id || "").toLowerCase();
  if (p.includes("plus") || p.includes("empresarial") || p.includes("corporativo") || p.includes("franquicia")) return "enterprise";
  if (p.includes("restaurante") || p.includes("profesional")) return "pro";
  return "basic";
}

// Funciones avanzadas del dashboard (top productos, canales) solo en pro+.
export function hasAdvancedReports(id) {
  const t = planTier(id);
  return t === "pro" || t === "enterprise";
}

export function moneyMX(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}
