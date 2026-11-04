export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { ClientesPanel } from "@/components/ClientesPanel";
import { requireTenantSetup } from "@/lib/auth";

export default async function ClientesPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Clientes" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,address,notes,visits,last_seen")
    .eq("restaurant_id", membership.restaurant_id)
    .order("last_seen", { ascending: false })
    .limit(200);

  return (
    <AppShell
      title="Clientes"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      {error ? (
        <div className="card p-5">
          <h2 className="text-2xl">El directorio todavía no está en la base</h2>
          <p className="mt-2 text-base text-[var(--ink-soft)]">
            Los pedidos ya guardan nombre y teléfono en la cuenta. La lista reutilizable aparece con la migración de clientes.
          </p>
        </div>
      ) : (
        <ClientesPanel restaurantId={membership.restaurant_id} initial={data || []} />
      )}
    </AppShell>
  );
}
