import { AppShell } from "@/components/AppShell";
import { requireTenantSetup } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MasaPage() {
  const { membership, operational, setupOnly } = await requireTenantSetup();
  return (
    <AppShell
      title="Producción de masa"
      restaurantName={membership?.restaurants?.name}
      role={membership?.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <article className="max-w-xl border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-6">
        <h2 className="text-3xl font-normal">Producción de masa</h2>
        <p className="mt-3 text-[var(--color-espresso)]">
          En el Wapifood original esta pantalla también estaba en desarrollo: no había registro de lotes ni descuento de harina.
        </p>
        <p className="mt-2 text-sm text-[var(--color-walnut)]">
          El inventario de insumos y las entradas de stock ya cubren el movimiento de harina hasta que exista el módulo de producción.
        </p>
      </article>
    </AppShell>
  );
}
