export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireTenantOperational } from "@/lib/auth";

export default async function KioskoIndexPage() {
  const { membership, operational, setupOnly } = await requireTenantOperational();
  const rid = membership?.restaurant_id;

  return (
    <AppShell
      title="Kiosko"
      restaurantName={membership?.restaurants?.name}
      role={membership?.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
        <h2 className="text-2xl">Kiosko del restaurante</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Tablet del local para que el cliente arme su pedido. Requiere plan activo.
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
