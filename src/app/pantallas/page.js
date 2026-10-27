export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireTenantOperational } from "@/lib/auth";

export default async function PantallasPage() {
  const { membership, operational, setupOnly } = await requireTenantOperational();
  const rid = membership?.restaurant_id;

  return (
    <AppShell
      title="Pantallas"
      restaurantName={membership?.restaurants?.name}
      role={membership?.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-[var(--color-muted)]">
        Atajos a pantallas del local (cocina, POS, vista TV).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/cocina"
          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 hover:border-[var(--color-ember)]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">Cocina</p>
          <h2 className="mt-2 text-2xl">Comandas</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Pedidos en cocina / listos.</p>
        </Link>
        <Link
          href="/pos"
          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 hover:border-[var(--color-ember)]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">Piso</p>
          <h2 className="mt-2 text-2xl">Punto de venta</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Caja y mesas.</p>
        </Link>
        {rid ? (
          <Link
            href={`/vista/${rid}/cocina`}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 hover:border-[var(--color-ember)]"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">TV / tablet</p>
            <h2 className="mt-2 text-2xl">Cocina externa</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Sin menú de administración.</p>
          </Link>
        ) : null}
        <Link
          href="/tickets"
          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 hover:border-[var(--color-ember)]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">Historial</p>
          <h2 className="mt-2 text-2xl">Tickets</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Cuentas pagadas e impresión.</p>
        </Link>
      </div>
    </AppShell>
  );
}
