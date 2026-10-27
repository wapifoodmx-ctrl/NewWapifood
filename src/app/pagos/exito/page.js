"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PagosExitoPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("procesando");
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      // MP devuelve collection_status / status / external_reference
      const paymentStatus = params.get("collection_status") || params.get("status");
      const external = params.get("external_reference");
      const paymentId = params.get("payment_id") || params.get("collection_id");

      if (paymentStatus && paymentStatus !== "approved") {
        setStatus("error");
        setError("El pago no fue aprobado en Mercado Pago.");
        return;
      }

      let planId = params.get("planId");
      let billing = params.get("billing") || "mensual";
      let restaurantId = params.get("restaurantId");

      if (external) {
        try {
          const parsed = JSON.parse(external);
          planId = planId || parsed.planId;
          billing = billing || parsed.billing || "mensual";
          restaurantId = restaurantId || parsed.restaurantId;
        } catch {
          /* external_reference simple */
        }
      }

      if (!planId || !restaurantId) {
        // Sin datos: asumimos que el webhook o el usuario ya tenía plan; manda al panel
        setStatus("ok");
        return;
      }

      const supabase = createClient();
      const { error: err } = await supabase.rpc("activate_plan", {
        p_restaurant: restaurantId,
        p_plan: planId,
        p_billing: billing,
        p_provider: "mercadopago",
        p_provider_ref: paymentId || null,
      });

      // Si la firma de 5 args no existe, intenta la de 3
      if (err) {
        const { error: err2 } = await supabase.rpc("activate_plan", {
          p_restaurant: restaurantId,
          p_plan: planId,
          p_billing: billing,
        });
        if (err2) {
          setStatus("error");
          setError(err2.message || err.message);
          return;
        }
      }
      setStatus("ok");
    }
    run();
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-center">
        {status === "procesando" ? (
          <>
            <h1 className="text-2xl font-semibold">Confirmando tu pago…</h1>
            <p className="mt-2 text-[var(--color-muted)]">Mercado Pago nos avisó del regreso.</p>
          </>
        ) : null}
        {status === "ok" ? (
          <>
            <h1 className="text-2xl font-semibold">¡Pago recibido!</h1>
            <p className="mt-2 text-[var(--color-muted)]">Tu plan quedó activo. Ya puedes operar el restaurante.</p>
            <Link href="/dashboard" className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)]">
              Ir al panel
            </Link>
          </>
        ) : null}
        {status === "error" ? (
          <>
            <h1 className="text-2xl font-semibold">No pudimos activar el plan</h1>
            <p className="mt-2 text-sm text-[var(--color-wine)]">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/pagos")}
              className="mt-6 h-12 rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)]"
            >
              Volver a pagos
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
