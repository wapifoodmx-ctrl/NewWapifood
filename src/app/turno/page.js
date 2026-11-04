export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { TurnoCaja } from "@/components/TurnoCaja";
import { requireTenantSetup } from "@/lib/auth";

export default async function TurnoPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Turno de caja" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  const rid = membership.restaurant_id;
  const openRes = await supabase
    .from("cash_sessions")
    .select("id,opening_float,opened_at,status")
    .eq("restaurant_id", rid)
    .eq("status", "open")
    .maybeSingle();

  const missing = Boolean(openRes.error);
  let moves = [];
  if (openRes.data?.id) {
    const moveRes = await supabase
      .from("cash_movements")
      .select("id,kind,amount,note,created_at")
      .eq("session_id", openRes.data.id)
      .order("created_at", { ascending: false });
    moves = moveRes.data || [];
  }
  const historyRes = missing
    ? { data: [] }
    : await supabase
        .from("cash_sessions")
        .select("id,closed_at,expected_cash,counted_cash,difference,status")
        .eq("restaurant_id", rid)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(12);

  return (
    <AppShell
      title="Turno de caja"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      {missing ? (
        <div className="card p-5">
          <h2 className="text-2xl">El corte todavía no está en la base</h2>
          <p className="mt-2 text-base text-[var(--ink-soft)]">
            La caja sigue cobrando. El fondo, las entradas, las salidas y la diferencia aparecen cuando se aplique la migración del turno.
          </p>
        </div>
      ) : (
        <TurnoCaja
          restaurantId={rid}
          initialSession={openRes.data}
          initialMoves={moves}
          history={historyRes.data || []}
        />
      )}
    </AppShell>
  );
}
