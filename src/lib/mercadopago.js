const MP_API = "https://api.mercadopago.com";

export function getMpToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    ""
  ).trim();
}

export function getSiteUrl(request) {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (request) {
    const origin = request.headers.get("origin");
    if (origin) return origin.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export async function mpFetch(path, { method = "GET", body } = {}) {
  const token = getMpToken();
  if (!token) throw new Error("Falta MERCADO_PAGO_ACCESS_TOKEN");
  const res = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Mercado Pago HTTP ${res.status}`;
    const err = new Error(msg);
    err.detail = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export function planAmount(planId, billing) {
  const monthly = { ventas: 400, restaurante: 600, plus: 800 };
  const yearly = { ventas: 4000, restaurante: 6000, plus: 8000 };
  const map = billing === "anual" ? yearly : monthly;
  return map[planId] ?? null;
}

export function parseExternalReference(ref) {
  if (!ref) return null;
  try {
    const j = JSON.parse(ref);
    if (j.restaurantId && j.planId) return j;
  } catch {
    /* formato user_123 legacy */
  }
  // restaurantId|planId|billing
  const parts = String(ref).split("|");
  if (parts.length >= 3) {
    return { restaurantId: parts[0], planId: parts[1], billing: parts[2] };
  }
  return null;
}
