/** Cookie httpOnly de una mesa. El QR impreso no lleva el token. */

const SLUG = /^[a-z0-9-]{1,80}$/;
const NUMBER = /^\d{1,6}$/;
const TOKEN = /^[a-f0-9]{64}$/;

export const MESA_COOKIE_MAX_AGE = 60 * 60 * 12;

function canonical(slug, number) {
  const safe = String(slug || "").toLowerCase();
  const raw = String(number ?? "");
  if (!SLUG.test(safe) || !NUMBER.test(raw)) return null;
  return { slug: safe, number: String(Number(raw)) };
}

export function mesaCookieName(slug, number) {
  const where = canonical(slug, number);
  return where ? `mesa_${where.slug}_${where.number}` : "";
}

export function mesaGateTarget({ open, hasCookie, lista }) {
  if (open) return "sesion";
  if (hasCookie && lista !== "1") return "sesion";
  return "closed";
}

export function mesaSessionDecision({ slug, number, open, token }) {
  const where = canonical(slug, number);
  if (!where) return { ok: false, location: "/", cookie: null };
  const base = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/${where.slug}/mesa/${where.number}`,
  };
  const name = `mesa_${where.slug}_${where.number}`;
  const clean = String(token || "").toLowerCase();
  if (!open || !TOKEN.test(clean)) {
    return {
      ok: true,
      location: `/${where.slug}/mesa/${where.number}?lista=1`,
      cookie: { name, value: "", options: { ...base, maxAge: 0 } },
    };
  }
  return {
    ok: true,
    location: `/${where.slug}/mesa/${where.number}/${clean}`,
    cookie: { name, value: clean, options: { ...base, maxAge: MESA_COOKIE_MAX_AGE } },
  };
}
