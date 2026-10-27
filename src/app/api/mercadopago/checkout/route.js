import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, mpFetch, planAmount } from "@/lib/mercadopago";

export async function POST(request) {
  try {
    const body = await request.json();
    const planId = body?.planId;
    const billing = body?.billing === "anual" ? "anual" : "mensual";
    const restaurantId = body?.restaurantId;

    if (!planId || !restaurantId || !["ventas", "restaurante", "plus"].includes(planId)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const amount = planAmount(planId, billing);
    if (amount == null) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Solo owner/admin
    const { data: mem } = await supabase
      .from("memberships")
      .select("role")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!mem || !["owner", "admin"].includes(String(mem.role))) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const origin = getSiteUrl(request);
    const titles = {
      ventas: "Plan Ventas",
      restaurante: "Plan Restaurante",
      plus: "Plan Restaurante Plus",
    };

    // Igual que API vieja: preference + notification_url (webhook)
    const external_reference = JSON.stringify({
      restaurantId,
      planId,
      billing,
      userId: auth.user.id,
    });

    const preference = await mpFetch("/checkout/preferences", {
      method: "POST",
      body: {
        items: [
          {
            title: `Wapifood · ${titles[planId]} (${billing})`,
            quantity: 1,
            unit_price: Number(amount),
            currency_id: "MXN",
          },
        ],
        payer: { email: auth.user.email },
        external_reference,
        metadata: {
          restaurant_id: restaurantId,
          plan_id: planId,
          billing,
          user_id: auth.user.id,
        },
        back_urls: {
          success: `${origin}/pagos/exito`,
          failure: `${origin}/pagos?status=failure`,
          pending: `${origin}/pagos?status=pending`,
        },
        auto_return: "approved",
        notification_url: `${origin}/api/mercadopago/webhook`,
        payment_methods: { installments: 1 },
      },
    });

    // Registro pendiente (opcional, para auditoría)
    await supabase.from("subscriptions").insert({
      restaurant_id: restaurantId,
      plan: planId,
      status: "pending",
      amount,
      billing,
      provider: "mercadopago",
      provider_ref: preference.id,
    });

    return NextResponse.json({
      id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    });
  } catch (e) {
    console.error("MP checkout", e.detail || e);
    return NextResponse.json(
      { error: e.message || "Error Mercado Pago", detail: e.detail },
      { status: e.status || 500 },
    );
  }
}
