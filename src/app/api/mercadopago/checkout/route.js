import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";

const PLAN_IDS = new Set(PLANS.map((p) => p.id));

export async function POST(request) {
  try {
    const body = await request.json();
    const planId = body?.planId;
    const billing = body?.billing === "anual" ? "anual" : "mensual";
    const restaurantId = body?.restaurantId;

    if (!planId || !PLAN_IDS.has(planId) || !restaurantId) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Falta MERCADOPAGO_ACCESS_TOKEN en el servidor (.env.local / Vercel)" },
        { status: 500 },
      );
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const plan = PLANS.find((p) => p.id === planId);
    const amount = billing === "anual" ? plan.yearly : plan.monthly;
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const preference = {
      items: [
        {
          title: `Wapifood · ${plan.title} (${billing})`,
          quantity: 1,
          unit_price: Number(amount),
          currency_id: "MXN",
        },
      ],
      external_reference: JSON.stringify({
        restaurantId,
        planId,
        billing,
        userId: auth.user.id,
      }),
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
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || data?.error || "Error Mercado Pago", detail: data },
        { status: 400 },
      );
    }

    return NextResponse.json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
