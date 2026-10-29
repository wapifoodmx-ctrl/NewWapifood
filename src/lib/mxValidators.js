/** Validaciones México */

export function onlyDigits(value, max) {
  return String(value || "").replace(/\D/g, "").slice(0, max);
}

/** Teléfono MX: 10 dígitos (sin 52). Acepta entrada con espacios/guiones/+52 */
export function normalizeMxPhone(value) {
  let d = onlyDigits(value, 13);
  if (d.startsWith("52") && d.length === 12) d = d.slice(2);
  if (d.startsWith("521") && d.length === 13) d = d.slice(3);
  return d.slice(0, 10);
}

export function isValidMxPhone(value) {
  const d = normalizeMxPhone(value);
  return d.length === 10;
}

export function formatMxPhoneDisplay(value) {
  const d = normalizeMxPhone(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** CP México: exactamente 5 dígitos */
export function normalizeMxPostalCode(value) {
  return onlyDigits(value, 5);
}

export function isValidMxPostalCode(value) {
  return normalizeMxPostalCode(value).length === 5;
}
