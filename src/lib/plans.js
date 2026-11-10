// Planes del SaaS. Una sola fuente para precios, topes y nombres.
// El precio multi es el total del grupo. Cada local usa los topes de su nivel.
// Los ids viejos siguen resolviendo al plan nuevo; no se reescriben filas ya pagadas.

const ALIASES = {
  brasa: "brasa",
  ventas: "brasa",
  esencial: "brasa",
  brasas: "brasas",
  ventas_multi: "brasas",
  cadena: "brasas",
  comal: "comal",
  restaurante: "comal",
  profesional: "comal",
  comales: "comales",
  restaurante_multi: "comales",
  franquicia: "comales",
  fogon: "fogon",
  "fogón": "fogon",
  plus: "fogon",
  empresarial: "fogon",
  fogones: "fogones",
  plus_multi: "fogones",
  corporativo: "fogones",
};

export const PLANS = [
  {
    id: "brasa",
    title: "Brasa",
    subtitle: "Para empezar a vender",
    monthly: 300,
    yearly: 3000,
    mesas: 5,
    meseros: 3,
    restaurants: 1,
    multi: false,
    popular: false,
    features: [
      "Punto de venta completo",
      "Cómo va el día y reportes",
      "Menú digital con QR",
      "Tickets digitales",
      "Cocina",
      "Inventario",
      "Hasta 5 mesas y 3 meseros",
    ],
  },
  {
    id: "comal",
    title: "Comal",
    subtitle: "Para el día a día del local",
    monthly: 500,
    yearly: 5000,
    mesas: 15,
    meseros: 7,
    restaurants: 1,
    multi: false,
    popular: true,
    features: [
      "Todo lo de Brasa",
      "Hasta 15 mesas y 7 meseros",
      "Menú digital con QR",
      "Tickets digitales",
      "Cocina en tiempo real",
      "Inventario y recetas",
      "Reportes más completos",
    ],
  },
  {
    id: "fogon",
    title: "Fogón",
    subtitle: "Para un local con mucho movimiento",
    monthly: 800,
    yearly: 8000,
    mesas: 25,
    meseros: 15,
    restaurants: 1,
    multi: false,
    popular: false,
    features: [
      "Todo lo de Comal",
      "Hasta 25 mesas y 15 meseros",
      "Prioridad en soporte",
      "Menú digital y kiosko",
      "Inventario avanzado",
      "Reportes ampliados",
    ],
  },
  {
    id: "brasas",
    title: "Brasas",
    subtitle: "Varios locales chicos, un solo pago",
    monthly: 500,
    yearly: 5000,
    mesas: 5,
    meseros: 3,
    restaurants: 3,
    multi: true,
    popular: false,
    features: [
      "Todo lo de Brasa en cada local",
      "Hasta 3 restaurantes",
      "El precio cubre todos los locales",
      "Hasta 5 mesas y 3 meseros por local",
      "Reportes por local",
    ],
  },
  {
    id: "comales",
    title: "Comales",
    subtitle: "Varios locales, un solo pago",
    monthly: 800,
    yearly: 8000,
    mesas: 15,
    meseros: 7,
    restaurants: 5,
    multi: true,
    popular: true,
    features: [
      "Todo lo de Comal en cada local",
      "Hasta 5 restaurantes",
      "El precio cubre todos los locales",
      "Hasta 15 mesas y 7 meseros por local",
      "Reportes por local",
    ],
  },
  {
    id: "fogones",
    title: "Fogones",
    subtitle: "Varios locales grandes, un solo pago",
    monthly: 1000,
    yearly: 10000,
    mesas: 25,
    meseros: 15,
    restaurants: 8,
    multi: true,
    popular: false,
    features: [
      "Todo lo de Fogón en cada local",
      "Hasta 8 restaurantes",
      "El precio cubre todos los locales",
      "Hasta 25 mesas y 15 meseros por local",
      "Soporte prioritario",
    ],
  },
];

export function canonicalPlanId(id) {
  const key = String(id || "").trim().toLowerCase();
  return ALIASES[key] || null;
}

export function resolvePlan(id) {
  const canon = canonicalPlanId(id);
  if (!canon) return null;
  return PLANS.find((p) => p.id === canon) || null;
}

export function planMeta(id) {
  return resolvePlan(id) || PLANS[0];
}

export function planTier(id) {
  const canon = canonicalPlanId(id);
  if (canon === "comal" || canon === "comales") return "pro";
  if (canon === "fogon" || canon === "fogones") return "enterprise";
  return "basic";
}

export function hasAdvancedReports(id) {
  const tier = planTier(id);
  return tier === "pro" || tier === "enterprise";
}

export function planAmount(planId, billing) {
  const plan = resolvePlan(planId);
  if (!plan) return null;
  return billing === "anual" ? plan.yearly : plan.monthly;
}

export function moneyMX(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}
