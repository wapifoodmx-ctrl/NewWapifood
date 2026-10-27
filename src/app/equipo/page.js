export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { requireTenant } from "@/lib/auth";

export default async function EquipoPage() {
  const { supabase, membership, user } = await requireTenant();
  if (!membership?.restaurant_id) {
    return <AppShell title="Equipo"><p>Sin restaurante.</p></AppShell>;
  }

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("restaurant_id", membership.restaurant_id);

  return (
    <AppShell title="Equipo" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Miembros del restaurante (roles multi-tenant). Los meseros de piso usan código en /mesero, no cuenta aquí.
      </p>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)]">
        {(members || []).map((m) => (
          <div key={m.user_id} className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3 last:border-0">
            <div>
              <p className="font-semibold font-mono text-sm">{m.user_id}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {m.user_id === user.id ? "Tú · " : ""}
                desde {m.created_at ? new Date(m.created_at).toLocaleDateString("es-MX") : "—"}
              </p>
            </div>
            <span className="rounded-full bg-[var(--color-cream)] px-3 py-1 text-xs font-bold uppercase">
              {m.role}
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
