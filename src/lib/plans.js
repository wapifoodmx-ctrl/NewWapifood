export const PLANS = [
  {
    id: "ventas",
    title: "Plan Ventas",
    monthly: 400,
    yearly: 4000,
    mesas: 3,
    meseros: 2,
  },
  {
    id: "restaurante",
    title: "Plan Restaurante",
    monthly: 600,
    yearly: 6000,
    mesas: 15,
    meseros: 5,
  },
  {
    id: "plus",
    title: "Plan Restaurante Plus",
    monthly: 800,
    yearly: 8000,
    mesas: 25,
    meseros: 10,
  },
];

export function planMeta(id) {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

export function moneyMX(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}
