/** Sistema Comal: color de categoría, cobro y textos claros. */

const CATEGORY_COLORS = ["#B93815", "#0F6E56", "#1D4E89", "#9D174D", "#8A5A00", "#3F6212", "#7C2D12", "#0F766E"];

export const PAY_METHODS = [
  { id: "efectivo", label: "Efectivo", hint: "Con cambio" },
  { id: "tarjeta", label: "Tarjeta", hint: "Terminal" },
  { id: "transferencia", label: "Otro tipo de pago", hint: "Transferencia, vales u otro" },
];

export function payLabel(method) {
  if (method === "efectivo") return "Efectivo";
  if (method === "tarjeta") return "Tarjeta";
  if (!method) return "Sin forma de pago";
  return "Otro tipo de pago";
}

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

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export function sourceLabel(source) {
  return (
    {
      pos: "Caja",
      web_menu: "Menú web",
      kiosko: "Kiosko",
      mesero: "Mesero",
      tablet: "Tablet",
      mesa: "Mesa",
    }[source] || "Caja"
  );
}

export function moveReasonLabel(reason) {
  return (
    {
      venta: "Venta",
      merma: "Merma",
      entrada: "Entrada",
      ajuste: "Ajuste",
      devolucion: "Devolución",
      compra: "Compra",
    }[reason] || "Movimiento"
  );
}

export function friendlyError(message) {
  const raw = String(message || "").trim();
  if (!raw) return "No se pudo completar. Intenta de nuevo.";
  const text = raw.toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials") || text.includes("email not confirmed") || text.includes("already registered")) {
    return friendlyAuthError(raw);
  }
  if (text.includes("jwt") || text.includes("not authenticated") || text.includes("no autenticado")) {
    return "Tu sesión venció. Vuelve a entrar.";
  }
  if (text.includes("row-level") || text.includes("row level") || text.includes("permission denied") || text.includes("sin permiso")) {
    return "No tienes permiso para hacer eso.";
  }
  if (text.includes("duplicate") || text.includes("unique constraint") || text.includes("already exists")) {
    return "Ese dato ya existe. Usa otro nombre o número.";
  }
  if (text.includes("foreign key")) {
    return "No se puede borrar porque ya se usó en pedidos o recetas.";
  }
  if (text.includes("check constraint") || text.includes("violates")) {
    return "Ese dato no es válido. Revísalo e inténtalo otra vez.";
  }
  if (text.includes("failed to fetch") || text.includes("network") || text.includes("fetch")) {
    return "No hay conexión. Revisa tu internet y vuelve a intentar.";
  }
  if (text.includes("plan activo") || text.includes("no tiene un plan")) {
    return "Necesitas un plan activo para vender.";
  }
  if (text.includes("código inválido") || text.includes("codigo invalido") || text.includes("confirmation")) {
    return "El código no coincide. Pídelo en el local.";
  }
  if (/sql\s*\d|supabase|\.sql|pgrst|schema|function public|does not exist|column |relation /.test(text)) {
    return "Eso todavía no está listo en el servidor. Avisa a soporte de Wapifood.";
  }
  const cleaned = raw
    .replace(UUID_RE, "")
    .replace(/¿[^?]*sql[^?]*\??/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
  if (!cleaned || /[{}[\]]|constraint|postgres|uuid/i.test(cleaned)) {
    return "No se pudo completar. Intenta de nuevo.";
  }
  return cleaned;
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
