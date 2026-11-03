import { createClient } from "@supabase/supabase-js";
import { serviceRoleConfig } from "@/lib/supabase/env";

/** Cliente service role — solo servidor (webhook). Nunca importar desde componentes cliente. */
export function createAdminClient() {
  const { url, key, configured } = serviceRoleConfig();
  if (!configured) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_URL en el servidor");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
