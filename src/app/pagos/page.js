import { AppShell } from "@/components/AppShell";
import { getMembership, requireUser } from "@/lib/auth";

export default async function Page() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  return (
    <AppShell title="Pagos y suscripción" restaurantName={membership?.restaurants?.name} role={membership?.role}>
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
        <h2 className="text-2xl">Pagos y suscripción</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Módulo en migración desde <code>pages/payments.js</code>. Ruta reservada; la lógica completa se porta en el siguiente bloque.
        </p>
      </div>
    </AppShell>
  );
}
