export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireTenant, requireTenantWithPlan } from "@/lib/auth";

export default async function KioskoIndexPage() {
  const { membership } = await requireTenantWithPlan();
  const rid = membership?.restaurant_id;

  return (
    <AppShell title="Kiosko" restaurantName={membership?.restaurants?.name} role={membership?.role}>
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
        <h2 className="text-2xl">Kiosko del restaurante</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Abre esta pantalla en una tablet del local para que los clientes armen su pedido.
        </p>
        {rid ? (
          <Link
            href={`/kiosko/${rid}`}
            className="mt-5 inline-flex h-12 items-center rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)]"
          >
            Abrir kiosko
          </Link>
        ) : (
          <p className="mt-4 text-[var(--color-wine)]">Sin restaurante vinculado.</p>
        )}
      </div>
    </AppShell>
  );
}
