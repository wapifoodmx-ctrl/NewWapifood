import crypto from "crypto";

const MP_API = "https://api.mercadopago.com";

export function getMpToken() {
  return (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim();
}

/**
 * URL pública del sitio sin variable nueva.
 * Production no define NEXT_PUBLIC_SITE_URL: se usa el origen de la petición
 * y, si no viene, el host que Vercel inyecta solo (VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL).
 */
export function getSiteUrl(request) {
  if (request) {
    const origin = request.headers.get("origin");
    if (origin) return origin.replace(/\/$/, "");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") || "https";
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}

export function mpCurrency() {
  const country = (process.env.MERCADO_PAGO_COUNTRY || "MX").trim().toUpperCase();
  const map = {
    MX: "MXN",
    AR: "ARS",
    BR: "BRL",
    CL: "CLP",
    CO: "COP",
    PE: "PEN",
    UY: "UYU",
  };
  return map[country] || "MXN";
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

export { planAmount, canonicalPlanId } from "@/lib/plans";

export function parseExternalReference(ref) {
  if (!ref) return null;
  try {
    const j = JSON.parse(ref);
    if (j.restaurantId && j.planId) return j;
  } catch {
    /* formato user_123 legacy */
  }
  const parts = String(ref).split("|");
  if (parts.length >= 3) {
    return { restaurantId: parts[0], planId: parts[1], billing: parts[2] };
  }
  return null;
}

/**
 * Firma oficial de webhooks de Mercado Pago (header x-signature + secreto).
 * data.id se toma de la query. Si es alfanumérico, va en minúsculas.
 */
export function verifyMercadoPagoWebhook(request, dataId) {
  const secret = (process.env.MERCADO_PAGO_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    return { ok: false, reason: "falta MERCADO_PAGO_WEBHOOK_SECRET" };
  }
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id") || "";
  if (!xSignature) {
    return { ok: false, reason: "sin firma" };
  }

  let ts = "";
  let hash = "";
  for (const part of xSignature.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") hash = value;
  }
  if (!ts || !hash || dataId == null || String(dataId).trim() === "") {
    return { ok: false, reason: "firma incompleta" };
  }

  const id = String(dataId).toLowerCase();
  const manifest = `id:${id};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "firma inválida" };
  }
  return { ok: true };
}
