/**
 * Unidades de inventario/recetas — paridad WapifoodFront.
 * Almacenamiento canónico (base):
 *   - masa: g (gramos)
 *   - volumen: ml (mililitros)
 *   - conteo: pza
 * UI puede capturar en kg/L y convertir ×1000 al guardar.
 */

const ALIASES = {
  g: "g",
  gr: "g",
  gramo: "g",
  gramos: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  ml: "ml",
  mililitro: "ml",
  mililitros: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  lt: "l",
  litro: "l",
  litros: "l",
  liter: "l",
  liters: "l",
  pza: "pza",
  pz: "pza",
  pieza: "pza",
  piezas: "pza",
  piece: "pza",
  pieces: "pza",
  unit: "pza",
  unidad: "pza",
  unidades: "pza",
};

/** Normaliza etiqueta de unidad a clave corta */
export function normalizeUnit(unit) {
  if (!unit) return "pza";
  const k = String(unit).trim().toLowerCase();
  return ALIASES[k] || k;
}

/** Unidad canónica de almacén para un tipo de medida */
export function baseUnit(unit) {
  const u = normalizeUnit(unit);
  if (u === "kg" || u === "g") return "g";
  if (u === "l" || u === "ml") return "ml";
  return "pza";
}

/** ¿Se puede alternar grande/chica? */
export function hasLargeSmall(unit) {
  const b = baseUnit(unit);
  return b === "g" || b === "ml";
}

export function largeUnit(base) {
  if (base === "g") return "kg";
  if (base === "ml") return "l";
  return base;
}

export function smallUnit(base) {
  return base;
}

/**
 * Convierte cantidad hacia unidad base de almacén.
 * Ej: (1.5, "kg") → { qty: 1500, unit: "g" }
 *     (50, "g") → { qty: 50, unit: "g" }
 *     (2, "l") → { qty: 2000, unit: "ml" }
 */
export function toBase(qty, unit) {
  const n = Number(qty);
  const q = Number.isFinite(n) ? n : 0;
  const u = normalizeUnit(unit);
  if (u === "kg") return { qty: q * 1000, unit: "g" };
  if (u === "l") return { qty: q * 1000, unit: "ml" };
  if (u === "g") return { qty: q, unit: "g" };
  if (u === "ml") return { qty: q, unit: "ml" };
  return { qty: q, unit: "pza" };
}

/**
 * Desde base hacia unidad de visualización.
 * Si stock >= 1000 g → sugiere kg (como Front).
 */
export function fromBase(qty, baseUnitKey, { forceSmall = false } = {}) {
  const n = Number(qty);
  const q = Number.isFinite(n) ? n : 0;
  const b = baseUnit(baseUnitKey);
  if (!forceSmall && (b === "g" || b === "ml") && Math.abs(q) >= 1000) {
    const divided = q / 1000;
    const pretty = Number(divided.toFixed(3));
    return { qty: pretty, unit: largeUnit(b) };
  }
  return { qty: q, unit: b };
}

/** Convierte valor mostrado (posible kg) a base según modo UI */
export function displayToBase(qty, baseUnitKey, usingLarge) {
  const b = baseUnit(baseUnitKey);
  if (usingLarge && (b === "g" || b === "ml")) {
    return toBase(qty, largeUnit(b));
  }
  return toBase(qty, b);
}

/** Etiqueta legible */
export function unitLabel(unit) {
  const u = normalizeUnit(unit);
  const map = {
    g: "g",
    kg: "kg",
    ml: "ml",
    l: "L",
    pza: "pza",
  };
  return map[u] || u;
}

export const UNIT_OPTIONS = [
  { value: "g", label: "Gramos (g)" },
  { value: "kg", label: "Kilos (kg) → se guarda en g" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "l", label: "Litros (L) → se guarda en ml" },
  { value: "pza", label: "Piezas" },
];
