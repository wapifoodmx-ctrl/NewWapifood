export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { EquipoPanel } from "@/components/EquipoPanel";
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

  const { data, error } = await supabase.rpc("list_team", {
    p_restaurant: membership.restaurant_id,
  });

  let fallback = null;
  if (error) {
    const members = await supabase
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("restaurant_id", membership.restaurant_id);
    fallback = {
      members: (members.data || []).map((m) => ({ ...m, email: null })),
      invites: [],
    };
  }

  const team = data || fallback || { members: [], invites: [] };
  const canManage = membership.role === "owner" || membership.role === "admin";

  return (
    <AppShell
      title="Equipo"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      {error ? (
        <p className="mb-4 text-base text-[var(--ink-soft)]">
          Todavía no se puede invitar desde la base ({error.message}). Se muestra la lista que ya existía.
        </p>
      ) : null}
      <EquipoPanel
        restaurantId={membership.restaurant_id}
        initial={team}
        currentUserId={user.id}
        canManage={canManage && !error}
      />
    </AppShell>
  );
}
