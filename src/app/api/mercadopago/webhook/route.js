import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mpFetch, parseExternalReference, planAmount } from "@/lib/mercadopago";

/**
 * Webhook Mercado Pago (como ApiWapifood /payments/webhook):
 * - Recibe topic=payment + id
 * - Consulta el pago en MP
 * - Si approved → activa suscripción en Supabase (service role)
 */
async function activateFromPayment(paymentId) {
  const payment = await mpFetch(`/v1/payments/${paymentId}`);
  const status = payment.status;
  const external = parseExternalReference(payment.external_reference);
  const meta = payment.metadata || {};

  const restaurantId = external?.restaurantId || meta.restaurant_id;
  const planId = external?.planId || meta.plan_id;
  const billing = external?.billing || meta.billing || "mensual";

  console.log("MP payment", paymentId, status, restaurantId, planId);

  if (!restaurantId || !planId) {
    return { ok: false, reason: "sin external_reference" };
  }

  if (status !== "approved") {
    return { ok: true, reason: `status=${status}` };
  }

  const amount =
    Number(payment.transaction_amount) || planAmount(planId, billing) || 0;
  const days = billing === "anual" ? 365 : 30;
  const ends = new Date();
  ends.setDate(ends.getDate() + days);

  const admin = createAdminClient();

  // Idempotencia: ya activado con este payment id
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider", "mercadopago")
    .eq("provider_ref", String(paymentId))
    .eq("status", "active")
    .maybeSingle();
  if (existing) {
    return { ok: true, reason: "ya activo" };
  }

  // Cierra pendientes de la misma preference
  if (payment.preference_id) {
    await admin
      .from("subscriptions")
      .update({ status: "active", provider_ref: String(paymentId), ends_at: ends.toISOString() })
      .eq("provider_ref", payment.preference_id)
      .eq("status", "pending");
  }

  const { error } = await admin.from("subscriptions").insert({
    restaurant_id: restaurantId,
    plan: planId,
    status: "active",
    amount,
    billing,
    provider: "mercadopago",
    provider_ref: String(paymentId),
    ends_at: ends.toISOString(),
  });

  if (error) {
    console.error("activate sub", error);
    return { ok: false, reason: error.message };
  }

  return { ok: true, reason: "activado" };
}

async function handle(request) {
  try {
    const url = new URL(request.url);
    let topic = url.searchParams.get("topic") || url.searchParams.get("type");
    let paymentId = url.searchParams.get("id") || url.searchParams.get("data.id");

    let payload = {};
    if (request.method === "POST") {
      try {
        payload = await request.json();
      } catch {
        payload = {};
      }
      topic = topic || payload.topic || payload.type || payload.action;
      paymentId =
        paymentId ||
        payload?.data?.id ||
        (payload?.resource ? String(payload.resource).split("/").pop() : null);
    }

    // Normaliza action payment.created → payment
    if (topic && String(topic).includes("payment")) topic = "payment";

    if (topic === "payment" && paymentId) {
      const result = await activateFromPayment(paymentId);
      return NextResponse.json({ status: "success", ...result });
    }

    return NextResponse.json({ status: "ignored", topic, paymentId });
  } catch (e) {
    console.error("MP webhook error", e);
    // MP reintenta si no es 2xx; devolvemos 200 si es config, 500 si queremos retry
    return NextResponse.json({ status: "error", message: e.message }, { status: 200 });
  }
}

export async function POST(request) {
  return handle(request);
}

export async function GET(request) {
  return handle(request);
}
