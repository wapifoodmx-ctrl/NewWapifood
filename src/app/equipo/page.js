export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { requireTenantSetup } from "@/lib/auth";

export default async function EquipoPage() {
  const { supabase, membership, user, operational, setupOnly } = await requireTenantSetup();

  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Equipo" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante. Vuelve a iniciar sesión.</p>
      </AppShell>
    );
  }

  const { data: members, error } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("restaurant_id", membership.restaurant_id);

  return (
    <AppShell
      title="Equipo"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-[var(--color-muted)]">
        Cuentas con acceso al panel (owner/admin). Los meseros de piso usan su propio acceso en{" "}
        <code className="rounded bg-[var(--color-cream)] px-1">/mesero/…</code>, no esta pantalla.
      </p>

      {error ? (
        <p className="mb-4 text-sm text-[var(--color-wine)]">Error al cargar: {error.message}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)]">
        {(members || []).length === 0 ? (
          <p className="p-5 text-[var(--color-muted)]">No hay miembros registrados.</p>
        ) : (
          (members || []).map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3 last:border-0"
            >
              <div>
                <p className="font-mono text-sm font-semibold">{m.user_id}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {user && m.user_id === user.id ? "Tú · " : ""}
                  desde {m.created_at ? new Date(m.created_at).toLocaleDateString("es-MX") : "—"}
                </p>
              </div>
              <span className="rounded-full bg-[var(--color-cream)] px-3 py-1 text-xs font-bold uppercase">
                {m.role}
              </span>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
