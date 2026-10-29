export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { KitchenBoard } from "@/components/KitchenBoard";
import { requireTenantOperational } from "@/lib/auth";

export default async function CocinaPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantOperational();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Cocina" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  const rid = membership.restaurant_id;
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id,status,source,order_type,customer_phone,delivery_address,opened_at,needs_confirmation,public_code,order_items(product_id,qty,unit_price,notes),dining_tables(number)",
    )
    .eq("restaurant_id", rid)
    .in("status", ["cocina", "lista", "pendiente"])
    .order("opened_at", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("id,name")
    .eq("restaurant_id", rid);

  return (
    <AppShell
      title="Cocina"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <KitchenBoard restaurantId={rid} initialOrders={orders || []} products={products || []} />
    </AppShell>
  );
}
