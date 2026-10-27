/** Sube imagen al bucket público public-media. Devuelve URL pública. */
export async function uploadPublicImage(supabase, restaurantId, file, folder = "misc") {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${restaurantId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("public-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("public-media").getPublicUrl(path);
  return data.publicUrl;
}
