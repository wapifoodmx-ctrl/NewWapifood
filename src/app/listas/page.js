export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { ListsManager } from "@/components/ListsManager";
import { requireTenantSetup } from "@/lib/auth";
import { isMissingRelation } from "@/lib/schema";

export default async function ListasPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Listas" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }
  const rid = membership.restaurant_id;
  const [{ data: products }, listsResult] = await Promise.all([
    supabase.from("products").select("id,name").eq("restaurant_id", rid).eq("active", true).order("name"),
    supabase
      .from("product_lists")
      .select("id,name,product_list_items(product_id,sort_order)")
      .eq("restaurant_id", rid)
      .order("created_at"),
  ]);

  return (
    <AppShell title="Listas" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-sm text-[var(--color-espresso)]">
        Listas de productos para pantallas, como la custom-list del API legado.
      </p>
      <ListsManager
        restaurantId={rid}
        products={products || []}
        initialLists={listsResult.error ? [] : listsResult.data || []}
        unavailable={Boolean(listsResult.error && isMissingRelation(listsResult.error))}
      />
      {listsResult.error && !isMissingRelation(listsResult.error) ? (
        <p className="mt-3 text-sm text-[var(--color-wine)]">{listsResult.error.message}</p>
      ) : null}
    </AppShell>
  );
}
