export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { requireTenantOperational } from "@/lib/auth";
import { PosBoard } from "@/components/PosBoard";
import { normalizeExtraRow } from "@/lib/extras";

export default async function PosPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantOperational();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Punto de venta" operational={operational} setupOnly={setupOnly}>
        <p>Configura tu membership primero.</p>
      </AppShell>
    );
  }
  const rid = membership.restaurant_id;
  const [{ data: tables }, { data: products }, { data: categories }, { data: orders }, extrasResult, { data: modifierGroups }, { data: modifierOptions }, { data: modifierLinks }] =
    await Promise.all([
      supabase.from("dining_tables").select("*").eq("restaurant_id", rid).eq("active", true).order("number"),
      supabase.from("products").select("*").eq("restaurant_id", rid).eq("active", true).order("name"),
      supabase.from("categories").select("*").eq("restaurant_id", rid).order("name"),
      supabase
        .from("orders")
        .select("*, order_items(*, order_item_extras(ingredient_id,qty,extra_price), order_item_modifiers(id,name,extra_price))")
        .eq("restaurant_id", rid)
        .neq("status", "pagada")
        .neq("status", "cancelada"),
      supabase
        .from("product_extras")
        .select("product_id,ingredient_id,qty,extra_price,ingredients(name,unit)"),
      supabase.from("modifier_groups").select("id,name,min_select,max_select,required").eq("restaurant_id", rid),
      supabase.from("modifier_options").select("id,group_id,name,extra_price"),
      supabase.from("product_modifier_groups").select("product_id,group_id"),
    ]);

  return (
    <AppShell title="Caja" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly} focus>
      <PosBoard
        restaurantId={rid}
        tables={tables || []}
        products={products || []}
        categories={categories || []}
        initialOrders={orders || []}
        modifierGroups={(modifierGroups || []).map((group) => ({
          ...group,
          options: (modifierOptions || []).filter((option) => option.group_id === group.id),
        }))}
        modifierLinks={modifierLinks || []}
        productExtras={
          extrasResult.error
            ? []
            : (extrasResult.data || [])
                .map(normalizeExtraRow)
                .filter((row) => row && (products || []).some((p) => p.id === row.product_id))
        }
      />
    </AppShell>
  );
}
