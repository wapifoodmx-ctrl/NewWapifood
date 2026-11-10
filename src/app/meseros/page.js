export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { WaitersPanel } from "@/components/WaitersPanel";
import { requireTenantSetup } from "@/lib/auth";
import { planMeta } from "@/lib/plans";

export default async function MeserosPage() {
  const { supabase, membership, operational, setupOnly, plan } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return <AppShell title="Meseros" operational={operational} setupOnly={setupOnly}><p>Sin restaurante.</p></AppShell>;
  }
  const rid = membership.restaurant_id;
  const [{ data: waiters }, { data: tables }] = await Promise.all([
    supabase.from("waiters").select("*").eq("restaurant_id", rid).order("name"),
    supabase.from("dining_tables").select("*").eq("restaurant_id", rid).eq("active", true).order("number"),
  ]);

  let assignments = [];
  if ((waiters || []).length) {
    const ids = waiters.map((w) => w.id);
    const { data } = await supabase.from("waiter_tables").select("waiter_id,table_id").in("waiter_id", ids);
    assignments = data || [];
  }

  const stats = {};
  const [{ data: paidOrders, error: paidError }, { data: recipeLines }, { data: ingredients }, { data: productCosts }] = await Promise.all([
    supabase
      .from("orders")
      .select("waiter_id, charged_food, order_items(qty, unit_price, product_id, status)")
      .eq("restaurant_id", rid)
      .eq("status", "pagada"),
    supabase.from("recipe_lines").select("product_id, ingredient_id, qty"),
    supabase.from("ingredients").select("id, cost").eq("restaurant_id", rid),
    supabase.from("products").select("id, cost").eq("restaurant_id", rid),
  ]);
  const costByIngredient = Object.fromEntries((ingredients || []).map((item) => [item.id, Number(item.cost) || 0]));
  const recipeByProduct = {};
  for (const line of recipeLines || []) {
    recipeByProduct[line.product_id] = (recipeByProduct[line.product_id] || 0) + Number(line.qty) * (costByIngredient[line.ingredient_id] || 0);
  }
  const fallbackCost = Object.fromEntries((productCosts || []).map((item) => [item.id, Number(item.cost) || 0]));
  if (!paidError) {
    for (const order of paidOrders || []) {
      if (!order.waiter_id) continue;
      const items = (order.order_items || []).filter((item) => item.status !== "cancelado");
      const raw = items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.qty), 0);
      const sales = order.charged_food == null ? raw : Number(order.charged_food);
      const cost = items.reduce((sum, item) => sum + Number(item.qty) * (recipeByProduct[item.product_id] ?? fallbackCost[item.product_id] ?? 0), 0);
      const row = stats[order.waiter_id] || { tickets: 0, sales: 0, margin: 0 };
      row.tickets += 1;
      row.sales += sales;
      row.margin += sales - cost;
      stats[order.waiter_id] = row;
    }
  }

  return (
    <AppShell title="Meseros" restaurantName={membership.restaurants?.name} role={membership.role} operational={operational} setupOnly={setupOnly}>
      <p className="mb-4 text-[var(--color-muted)]">
        Altas, códigos de acceso y asignación de mesas. El cobrado ya resta descuentos. El margen resta el costo de la receta.
      </p>
      <WaitersPanel
        restaurantId={rid}
        initialWaiters={waiters || []}
        tables={tables || []}
        initialAssignments={assignments}
        waiterLimit={planMeta(plan?.plan).meseros}
        stats={stats}
      />
    </AppShell>
  );
}
