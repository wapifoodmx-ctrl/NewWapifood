import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const ownerArg = process.argv.find((a) => a.startsWith("--owner="));
const ownerId = ownerArg ? ownerArg.slice(8).trim() : null;
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const RID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function upsert(table, rows, onConflict = "id") {
  const { error } = await sb.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table} (${rows.length})`);
}

await upsert("restaurants", [{ id: RID, name: "Taquería Demo Wapifood" }]);
await upsert("categories", [
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", restaurant_id: RID, name: "Tacos" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2", restaurant_id: RID, name: "Antojitos" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3", restaurant_id: RID, name: "Bebidas" },
]);
await upsert("products", [
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc1", restaurant_id: RID, category_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", name: "Tacos de pastor", price: 48, cost: 18, active: true },
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc2", restaurant_id: RID, category_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", name: "Tacos de suadero", price: 52, cost: 20, active: true },
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc3", restaurant_id: RID, category_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2", name: "Quesadilla de champiñón", price: 64, cost: 22, active: true },
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc4", restaurant_id: RID, category_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2", name: "Gringa", price: 78, cost: 28, active: true },
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc5", restaurant_id: RID, category_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3", name: "Agua de jamaica", price: 32, cost: 6, active: true },
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc6", restaurant_id: RID, category_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3", name: "Refresco", price: 28, cost: 12, active: true },
]);
await upsert("ingredients", [
  { id: "dddddddd-dddd-dddd-dddd-ddddddddddd1", restaurant_id: RID, name: "Tortilla", unit: "pza", stock: 180, min_stock: 40 },
  { id: "dddddddd-dddd-dddd-dddd-ddddddddddd2", restaurant_id: RID, name: "Pastor", unit: "g", stock: 2400, min_stock: 600 },
  { id: "dddddddd-dddd-dddd-dddd-ddddddddddd3", restaurant_id: RID, name: "Suadero", unit: "g", stock: 900, min_stock: 500 },
  { id: "dddddddd-dddd-dddd-dddd-ddddddddddd4", restaurant_id: RID, name: "Queso", unit: "g", stock: 700, min_stock: 250 },
  { id: "dddddddd-dddd-dddd-dddd-ddddddddddd5", restaurant_id: RID, name: "Jamaica", unit: "ml", stock: 4000, min_stock: 800 },
  { id: "dddddddd-dddd-dddd-dddd-ddddddddddd6", restaurant_id: RID, name: "Refresco lata", unit: "pza", stock: 24, min_stock: 12 },
]);
await upsert("recipe_lines", [
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc1", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd1", qty: 2 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc1", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd2", qty: 80 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc2", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd1", qty: 2 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc2", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd3", qty: 90 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc3", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd1", qty: 1 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc3", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd4", qty: 60 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc4", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd1", qty: 1 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc4", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd2", qty: 70 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc4", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd4", qty: 40 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc5", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd5", qty: 350 },
  { product_id: "cccccccc-cccc-cccc-cccc-ccccccccccc6", ingredient_id: "dddddddd-dddd-dddd-dddd-ddddddddddd6", qty: 1 },
], "product_id,ingredient_id");
await upsert("dining_tables", [
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1", restaurant_id: RID, number: 1, seats: 2, state: "libre", active: true },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2", restaurant_id: RID, number: 2, seats: 2, state: "libre", active: true },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3", restaurant_id: RID, number: 3, seats: 4, state: "libre", active: true },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4", restaurant_id: RID, number: 4, seats: 2, state: "libre", active: true },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5", restaurant_id: RID, number: 5, seats: 4, state: "libre", active: true },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6", restaurant_id: RID, number: 6, seats: 2, state: "libre", active: true },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee7", restaurant_id: RID, number: 7, seats: 4, state: "libre", active: true },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee8", restaurant_id: RID, number: 8, seats: 2, state: "libre", active: true },
]);
if (ownerId) {
  const { error } = await sb.from("memberships").upsert(
    { restaurant_id: RID, user_id: ownerId, role: "owner" },
    { onConflict: "restaurant_id,user_id" },
  );
  if (error) throw new Error(error.message);
  console.log("✓ membership owner");
}
console.log("\nSeed listo.");
