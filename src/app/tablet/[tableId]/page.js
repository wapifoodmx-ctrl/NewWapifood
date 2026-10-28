export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { TabletMenu } from "@/components/TabletMenu";

export default async function TabletPage({ params }) {
  const { tableId } = await params;
  const supabase = await createClient();

  const { data: table } = await supabase
    .from("dining_tables")
    .select("id,number,seats,channel_type,access_pin,active,restaurant_id")
    .eq("id", tableId)
    .maybeSingle();

  if (!table || table.active === false) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-parchment)] px-4">
        <p className="text-lg">Mesa no encontrada o inactiva</p>
      </div>
    );
  }

  const restaurantId = table.restaurant_id;
  const [{ data: restaurant }, { data: canOps }, { data: products }, { data: categories }, { data: theme }, { data: profile }] =
    await Promise.all([
      supabase.from("restaurants").select("id,name,logo_url").eq("id", restaurantId).maybeSingle(),
      supabase.rpc("can_operate", { p_restaurant: restaurantId }),
      supabase
        .from("products")
        .select("id,name,description,price,category_id,image_url,active")
        .eq("restaurant_id", restaurantId)
        .eq("active", true)
        .order("name"),
      supabase.from("categories").select("id,name").eq("restaurant_id", restaurantId).order("name"),
      supabase.from("menu_theme").select("primary_color,secondary_color").eq("restaurant_id", restaurantId).maybeSingle(),
      supabase
        .from("restaurant_profiles")
        .select("delivery_enabled,require_confirm_code")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
    ]);

  if (!restaurant) {
    return <div className="grid min-h-screen place-items-center">Restaurante no encontrado</div>;
  }

  return (
    <TabletMenu
      restaurant={restaurant}
      theme={theme}
      products={products || []}
      categories={categories || []}
      table={table}
      profile={profile}
      canOperate={!!canOps}
    />
  );
}
