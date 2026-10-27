export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { requireTenantWithPlan } from "@/lib/auth";
import { PosBoard } from "@/components/PosBoard";

export default async function PosPage() {
  const { supabase, membership } = await requireTenantWithPlan();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Punto de venta">
        <p>Configura tu membership primero.</p>
      </AppShell>
    );
  }
  const rid = membership.restaurant_id;
  const [{ data: tables }, { data: products }, { data: categories }, { data: orders }] =
    await Promise.all([
      supabase.from("dining_tables").select("*").eq("restaurant_id", rid).eq("active", true).order("number"),
      supabase.from("products").select("*").eq("restaurant_id", rid).eq("active", true).order("name"),
      supabase.from("categories").select("*").eq("restaurant_id", rid).order("name"),
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("restaurant_id", rid)
        .neq("status", "pagada")
        .neq("status", "cancelada"),
    ]);

  return (
    <AppShell title="Punto de venta" restaurantName={membership.restaurants?.name} role={membership.role}>
      <PosBoard
        restaurantId={rid}
        tables={tables || []}
        products={products || []}
        categories={categories || []}
        initialOrders={orders || []}
      />
    </AppShell>
  );
}
