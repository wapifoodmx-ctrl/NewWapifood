"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
function ExitoInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState("procesando");
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      const paymentStatus = params.get("collection_status") || params.get("status");
      if (paymentStatus && paymentStatus !== "approved" && paymentStatus !== "success") {
        setStatus("error");
        setError("El pago no fue aprobado en Mercado Pago.");
        return;
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
            <p className="mt-2 text-[var(--color-muted)]">Mercado Pago y el webhook están procesando.</p>
          </>
        ) : null}
        {status === "ok" ? (
          <>
            <h1 className="text-2xl font-semibold">¡Pago recibido!</h1>
            <p className="mt-2 text-[var(--color-muted)]">
              Tu plan se activa automáticamente (webhook). Ya puedes usar el panel.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)]"
            >
              Ir al panel
            </Link>
          </>
        ) : null}
        {status === "error" ? (
          <>
            <h1 className="text-2xl font-semibold">Pago no aprobado</h1>
            <p className="mt-2 text-sm text-[var(--color-wine)]">{error}</p>
            <Link href="/pagos" className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)]">
              Volver a pagos
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function PagosExitoPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center">Cargando…</div>}>
      <ExitoInner />
    </Suspense>
  );
}
