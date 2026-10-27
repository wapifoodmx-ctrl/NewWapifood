/**
 * Modos del SaaS:
 * - setup/trial: configurar carta, mesas, etc. SIN vender
 * - operational: plan active → POS, menú, kiosko, meseros operativos
 */

export function isOperationalPlan(plan) {
  if (!plan) return false;
  if (plan.status !== "active") return false;
  if (plan.ends_at && new Date(plan.ends_at) < new Date()) return false;
  return true;
}

export function isSetupPlan(plan) {
  if (!plan) return true; // sin fila = solo setup vacío
  if (plan.status === "trialing") {
    if (plan.ends_at && new Date(plan.ends_at) < new Date()) return false;
    return true;
  }
  return false;
}

/** Módulos permitidos en trial/setup (sin operación de ventas). */
export const SETUP_MODULE_IDS = new Set([
  "dashboard",
  "config",
  "carta",
  "insumos",
  "recetas",
  "mesas",
  "meseros", // alta de fichas; el login operativo se bloquea sin plan active
  "pagos",
  "equipo",
]);

/** Módulos que exigen plan active. */
export const OPERATIONAL_MODULE_IDS = new Set([
  "pos",
  "kitchen",
  "tickets",
  "pantallas",
  "menu-cliente",
  "kiosko",
]);
