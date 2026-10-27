export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireTenantOperational } from "@/lib/auth";

export default async function MenuIndexPage() {
  const { membership, operational, setupOnly } = await requireTenantOperational();
  const rid = membership?.restaurant_id;
  const name = membership?.restaurants?.name || "Tu restaurante";

  return (
    <AppShell
      title="Menú QR"
      restaurantName={name}
      role={membership?.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
        <h2 className="text-2xl">Menú digital / QR</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Comparte este enlace con tus clientes. Requiere plan activo.
        </p>
        {rid ? (
          <>
            <code className="mt-4 block break-all rounded-xl bg-[var(--color-cream)] px-3 py-2 text-sm">
              /m/{rid}
            </code>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/m/${rid}`}
                className="inline-flex h-12 items-center rounded-full bg-[var(--color-ember)] px-6 font-semibold text-white"
              >
                Abrir menú público
              </Link>
              <Link
                href={`/kiosko/${rid}`}
                className="inline-flex h-12 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] px-6 font-semibold"
              >
                Abrir kiosko
              </Link>
              <Link
                href={`/mesero/${rid}`}
                className="inline-flex h-12 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] px-6 font-semibold"
              >
                Acceso mesero
              </Link>
            </div>
          </>
        ) : (
          <p className="mt-4 text-[var(--color-wine)]">Sin restaurante vinculado.</p>
        )}
      </div>
    </AppShell>
  );
}
