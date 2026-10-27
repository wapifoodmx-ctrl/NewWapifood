import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureRestaurant } from "@/lib/onboarding";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function getMembership(supabase, userId) {
  const { data } = await supabase
    .from("memberships")
    .select("restaurant_id, role, restaurants(id, name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data;
}

/** Usuario autenticado + restaurante asegurado (SaaS automático). */
export async function requireTenant() {
  const { supabase, user } = await requireUser();
  let membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    try {
      await ensureRestaurant(supabase, "Mi restaurante");
      membership = await getMembership(supabase, user.id);
    } catch {
      // Si falta el RPC 005, el dashboard mostrará guía mínima interna
    }
  }
  return { supabase, user, membership };
}
