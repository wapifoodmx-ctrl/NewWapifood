import { createBrowserClient } from "@supabase/ssr";
import { browserSupabaseConfig, supabaseClientOptions } from "@/lib/supabase/env";

export function createClient() {
  const cfg = supabaseClientOptions(browserSupabaseConfig());
  return createBrowserClient(cfg.url, cfg.key);
}
