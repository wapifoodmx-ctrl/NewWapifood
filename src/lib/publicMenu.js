import { createClient } from "@/lib/supabase/server";
import { normalizeExtraRow } from "@/lib/extras";

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

  const [
    { data: products },
    { data: categories },
    { data: tables },
    { data: theme },
    { data: profile },
    extrasResult,
    { data: modifierGroups },
    { data: modifierOptions },
    { data: modifierLinks },
  ] =
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
        .select("id,number,seats,channel_type,access_pin,state,active")
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
        .select("require_confirm_code,delivery_enabled,confirmation_code,schedule")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
      supabase
        .from("product_extras")
        .select("product_id,ingredient_id,qty,extra_price,ingredients(name,unit)")
        .limit(500),
      supabase.from("modifier_groups").select("id,name,min_select,max_select,required").eq("restaurant_id", restaurantId),
      supabase.from("modifier_options").select("id,group_id,name,extra_price"),
      supabase.from("product_modifier_groups").select("product_id,group_id"),
    ]);

  const extras = extrasResult.error
    ? []
    : (extrasResult.data || []).map(normalizeExtraRow).filter((row) => row && products?.some((p) => p.id === row.product_id));

  return {
    restaurant,
    products: products || [],
    categories: categories || [],
    tables: tables || [],
    theme: theme || null,
    profile: profile || null,
    extras,
    modifierGroups: (modifierGroups || []).map((group) => ({
      ...group,
      options: (modifierOptions || []).filter((option) => option.group_id === group.id),
    })),
    modifierLinks: (modifierLinks || []).filter((link) => products?.some((product) => product.id === link.product_id)),
    canOperate: !!canOps,
  };
}
