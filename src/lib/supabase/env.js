/**
 * Nombres exactos configurados en Vercel Production (proyecto new-wapifood).
 * Preview no tiene estas variables: el build no debe depender de que existan.
 */

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.placeholder";

export function browserSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key, configured: Boolean(url && key) };
}

export function serverSupabaseConfig() {
  const browser = browserSupabaseConfig();
  const url = (browser.url || process.env.SUPABASE_URL || "").trim();
  const key = (
    browser.key ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key, configured: Boolean(url && key) };
}

export function serviceRoleConfig() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();
  return { url, key, configured: Boolean(url && key) };
}

export function supabaseClientOptions(config) {
  return {
    url: config.url || PLACEHOLDER_URL,
    key: config.key || PLACEHOLDER_KEY,
    configured: config.configured,
  };
}
