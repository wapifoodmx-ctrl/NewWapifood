import Link from "next/link";

export const metadata = { title: "Pago no completado · Wapifood" };

export default function PagosErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-wine)]">Mercado Pago</p>
        <h1 className="mt-2 text-3xl font-semibold">No se completó el pago</h1>
        <p className="mt-3 text-[var(--color-muted)]">
          El pago fue cancelado o rechazado. Tu plan no se modificó. Puedes intentar de nuevo cuando quieras.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/pagos" className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]">
            Volver a planes
          </Link>
          <Link href="/dashboard" className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--color-line)] font-semibold">
            Ir al panel
          </Link>
        </div>
      </div>
    </div>
  );
}
