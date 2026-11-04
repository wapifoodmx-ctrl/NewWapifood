/** Sistema Comal: color de categoría, cobro y textos claros. */

const CATEGORY_COLORS = ["#B93815", "#0F6E56", "#1D4E89", "#9D174D", "#8A5A00", "#3F6212", "#7C2D12", "#0F766E"];

export const PAY_METHODS = [
  { id: "efectivo", label: "Efectivo", hint: "Con cambio" },
  { id: "tarjeta", label: "Tarjeta", hint: "Terminal" },
  { id: "transferencia", label: "Mercado Pago", hint: "Transferencia" },
];

export function categoryColor(key) {
  const text = String(key || "platillo");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

export function tableStateMeta(state, occupied) {
  if (state === "no_disponible") return { label: "No disponible", icon: "ban", tone: "off" };
  if (occupied || state === "ocupada") return { label: "Ocupada", icon: "users", tone: "busy" };
  return { label: "Libre", icon: "check", tone: "free" };
}

export function cashSuggestions(total) {
  const due = Math.ceil(Number(total) || 0);
  const steps = [due, 50, 100, 200, 500, 1000].filter((n) => n >= due && n > 0);
  return [...new Set(steps)].slice(0, 4);
}

export function friendlyAuthError(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "El correo o la contraseña no coinciden. Revísalos sin espacios de más, o toca «Olvidé mi contraseña».";
  }
  if (text.includes("email not confirmed")) {
    return "Falta confirmar tu correo. Abre el mensaje de Wapifood y toca el enlace. Si no llega, revisa la carpeta de spam.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Ese correo ya tiene cuenta. Entra con tu contraseña o recupérala.";
  }
  if (text.includes("password") && text.includes("6")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (text.includes("rate") || text.includes("too many")) {
    return "Demasiados intentos. Espera un minuto y vuelve a intentar.";
  }
  if (text.includes("network") || text.includes("fetch") || text.includes("failed to fetch")) {
    return "No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.";
  }
  return message || "No se pudo completar. Intenta de nuevo.";
}

export function haptic() {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* el navegador no vibra */
  }
}
