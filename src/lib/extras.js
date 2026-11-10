import { money } from "@/lib/format";

export function normalizeExtraRow(row) {
  if (!row) return null;
  return {
    product_id: row.product_id,
    ingredient_id: row.ingredient_id,
    qty: Number(row.qty) || 1,
    extra_price: Number(row.extra_price) || 0,
    name: row.ingredients?.name || row.name || "Adicional",
    unit: row.ingredients?.unit || row.unit || "",
  };
}

export function extrasForProduct(catalog, productId) {
  return (catalog || []).filter((e) => e.product_id === productId);
}

export function extrasCharge(extras) {
  return (extras || []).reduce((sum, e) => sum + Number(e.extra_price || 0), 0);
}

export function lineAmount(item) {
  if ((item?.status || "pendiente") === "cancelado") return 0;
  const extras = item?.order_item_extras || item?.extras || [];
  const mods = item?.order_item_modifiers || item?.modifiers || [];
  let line = (Number(item?.unit_price ?? item?.price) + extrasCharge(extras) + extrasCharge(mods)) * Number(item?.qty || 0);
  if (item?.discount_type === "porcentaje") {
    line -= line * (Number(item.discount_value) || 0) / 100;
  }
  if (item?.discount_type === "monto") {
    line -= Number(item.discount_value) || 0;
  }
  return Math.max(0, line);
}

export function extraPayload(extras) {
  return (extras || []).map((e) => ({
    ingredient_id: e.ingredient_id,
    qty: Number(e.qty) || 1,
  }));
}

export function formatExtraLabel(extra) {
  const name = extra?.name || extra?.ingredients?.name || "Adicional";
  const price = Number(extra?.extra_price || 0);
  return price > 0 ? `${name} (${money(price)})` : name;
}
