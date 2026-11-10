export const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number(n || 0),
  );

// Costo de un platillo a partir de sus recetas (recipe_lines.qty × ingredient.cost).
export function dishCost(productId, recipeLines, ingredients) {
  const byId = new Map((ingredients || []).map((i) => [i.id, Number(i.cost || 0)]));
  return (recipeLines || [])
    .filter((r) => r.product_id === productId)
    .reduce((s, r) => s + Number(r.qty || 0) * (byId.get(r.ingredient_id) || 0), 0);
}

// Margen de un platillo: precio - costo (de receta o cost manual).
export function margin(price, cost) {
  return Number(price || 0) - Number(cost || 0);
}
