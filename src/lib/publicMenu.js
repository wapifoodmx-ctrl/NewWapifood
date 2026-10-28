import { createClient } from "@/lib/supabase/server";

export async function loadPublicMenu(restaurantId) {
  const supabase = await createClient();
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id,name,logo_url")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !restaurant) return null;

  const { data: canOps } = await supabase.rpc("can_operate", {
    p_restaurant: restaurantId,
  });

  const [{ data: products }, { data: categories }, { data: tables }, { data: theme }, { data: profile }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,name,description,price,category_id,image_url,active")
        .eq("restaurant_id", restaurantId)
        .eq("active", true)
        .order("name"),
      supabase.from("categories").select("id,name").eq("restaurant_id", restaurantId).order("name"),
      supabase
        .from("dining_tables")
        .select("id,number,seats,channel_type,access_pin")
        .eq("restaurant_id", restaurantId)
        .eq("active", true)
        .order("number"),
      supabase
        .from("menu_theme")
        .select("primary_color,secondary_color,logo_url")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
      supabase
        .from("restaurant_profiles")
        .select("require_confirm_code,delivery_enabled,confirmation_code")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
    ]);

  return {
    restaurant,
    products: products || [],
    categories: categories || [],
    tables: tables || [],
    theme: theme || null,
    profile: profile || null,
    canOperate: !!canOps,
  };
}
