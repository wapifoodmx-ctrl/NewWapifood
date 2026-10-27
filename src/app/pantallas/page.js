export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getMembership, requireUser } from "@/lib/auth";

export default async function PantallasPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);

  return (
    <AppShell title="Pantallas" restaurantName={membership?.restaurants?.name} role={membership?.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Pantallas para cocina o turno. Abre en otra pestaña o tablet del local.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/cocina"
          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 hover:border-[var(--color-ember)]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">Cocina</p>
          <h2 className="mt-2 text-2xl">Pantalla de comandas</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Muestra pedidos en cocina / listos. Ideal en monitor de cocina.
          </p>
        </Link>
        <Link
          href="/pos"
          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 hover:border-[var(--color-ember)]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ember)]">Piso</p>
          <h2 className="mt-2 text-2xl">Punto de venta</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Caja y mesas. Usa otra ventana a pantalla completa.
          </p>
        </Link>
      </div>
    </AppShell>
  );
}
