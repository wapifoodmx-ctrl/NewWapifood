import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureRestaurant } from "@/lib/onboarding";
import { isOperationalPlan, isSetupPlan } from "@/lib/planMode";

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

/** Última suscripción relevante (active o trialing vigente). */
export async function getCurrentPlan(supabase, restaurantId) {
  if (!restaurantId) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(5);
  const list = data || [];
  const active = list.find((p) => isOperationalPlan(p));
  if (active) return active;
  const trial = list.find((p) => isSetupPlan(p));
  return trial || null;
}

export async function getActivePlan(supabase, restaurantId) {
  const plan = await getCurrentPlan(supabase, restaurantId);
  return isOperationalPlan(plan) ? plan : null;
}

/** Usuario + restaurante (sin inventar datos de negocio). */
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
  const plan = membership?.restaurant_id
    ? await getCurrentPlan(supabase, membership.restaurant_id)
    : null;
  return {
    supabase,
    user,
    membership,
    plan,
    operational: isOperationalPlan(plan),
    setupOnly: !isOperationalPlan(plan),
  };
}

/** Panel de configuración (trial OK). */
export async function requireTenantSetup() {
  return requireTenant();
}

/**
 * Operación real (POS, cocina con ventas, tickets…).
 * Trial → redirige a pagos con mensaje claro.
 */
export async function requireTenantOperational() {
  const ctx = await requireTenant();
  if (!ctx.operational) redirect("/pagos?motivo=operacion");
  return ctx;
}

/** @deprecated usar requireTenantOperational o requireTenantSetup */
export async function requireTenantWithPlan() {
  return requireTenantOperational();
}
