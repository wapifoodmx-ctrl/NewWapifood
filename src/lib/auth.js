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

export async function getActivePlan(supabase, restaurantId) {
  if (!restaurantId) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (data.ends_at && new Date(data.ends_at) < new Date()) return null;
  return data;
}

/** Usuario + restaurante automático. */
export async function requireTenant() {
  const { supabase, user } = await requireUser();
  let membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    try {
      await ensureRestaurant(supabase, "Mi restaurante");
      membership = await getMembership(supabase, user.id);
    } catch {
      /* RPC ausente */
    }
  }
  return { supabase, user, membership };
}

/**
 * Igual que requireTenant pero redirige a /pagos si no hay plan/trial vigente.
 * Excepciones: el caller no debe usarlo en /pagos.
 */
export async function requireTenantWithPlan() {
  const ctx = await requireTenant();
  const rid = ctx.membership?.restaurant_id;
  if (!rid) return ctx;
  const plan = await getActivePlan(ctx.supabase, rid);
  if (!plan) redirect("/pagos?motivo=plan");
  return { ...ctx, plan };
}
