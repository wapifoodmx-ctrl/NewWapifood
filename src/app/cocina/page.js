export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { KitchenBoard } from "@/components/KitchenBoard";
import { getMembership, requireUser } from "@/lib/auth";

export default async function CocinaPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    return <AppShell title="Cocina"><p>Sin restaurante.</p></AppShell>;
  }
  const rid = membership.restaurant_id;
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*), dining_tables(number)")
    .eq("restaurant_id", rid)
    .in("status", ["cocina", "lista"])
    .order("opened_at", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("id,name")
    .eq("restaurant_id", rid);

  return (
    <AppShell title="Cocina" restaurantName={membership.restaurants?.name} role={membership.role}>
      <KitchenBoard restaurantId={rid} initialOrders={orders || []} products={products || []} />
    </AppShell>
  );
}
