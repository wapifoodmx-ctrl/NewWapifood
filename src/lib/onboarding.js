export async function ensureRestaurant(supabase, name = "Mi restaurante") {
  const { data, error } = await supabase.rpc("create_my_restaurant", {
    p_name: name,
  });
  if (error) throw error;
  return data;
}
