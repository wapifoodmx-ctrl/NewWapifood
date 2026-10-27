export const dynamic = "force-dynamic";

import { KitchenBoard } from "@/components/KitchenBoard";
import { createClient } from "@/lib/supabase/server";

/** Pantalla cocina sin shell de admin (para TV/tablet). */
export default async function VistaCocinaPage({ params }) {
  const { restaurantId } = await params;
  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id,name")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!restaurant) {
    return <div className="grid min-h-screen place-items-center">Restaurante no encontrado</div>;
  }
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*), dining_tables(number)")
    .eq("restaurant_id", restaurantId)
    .in("status", ["cocina", "lista"])
    .order("opened_at", { ascending: true });
  const { data: products } = await supabase
    .from("products")
    .select("id,name")
    .eq("restaurant_id", restaurantId);

  return (
    <div className="min-h-screen bg-[var(--color-cream)] px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ember)]">Cocina</p>
        <h1 className="text-3xl">{restaurant.name}</h1>
        <div className="mt-6">
          <KitchenBoard restaurantId={restaurantId} initialOrders={orders || []} products={products || []} />
        </div>
      </div>
    </div>
  );
}
