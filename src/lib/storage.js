/**
 * Sube imagen al bucket público public-media.
 * Path: {restaurantId}/{folder}/{uuid}.ext
 * Requiere SQL 029 (bucket + policies).
 */
export async function uploadPublicImage(supabase, restaurantId, file, folder = "misc") {
  if (!restaurantId) throw new Error("Falta restaurantId para subir la imagen.");
  if (!file?.type?.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen no puede superar 5 MB.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${restaurantId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("public-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    const msg = error.message || String(error);
    if (/bucket|not found|404/i.test(msg)) {
      throw new Error("Bucket public-media no existe. Ejecuta SQL 029_storage_public_media.sql en Supabase.");
    }
    if (/policy|denied|row-level|403|unauthorized/i.test(msg)) {
      throw new Error("Sin permiso de storage. Ejecuta SQL 029 (policies del bucket public-media).");
    }
    throw new Error(msg);
  }

  const { data } = supabase.storage.from("public-media").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("No se obtuvo URL pública de la imagen.");
  return data.publicUrl;
}
