/** Insumos que el comensal puede quitar. La nota dice «Sin X». El stock sigue la receta. */

export function removableForProduct(catalog, productId) {
  return (catalog || []).filter((row) => row.product_id === productId);
}

export function sinLabel(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  return /^sin\s/i.test(clean) ? clean : `Sin ${clean}`;
}

export function composeLineNote(freeText, omitted) {
  const sins = (omitted || []).map((row) => sinLabel(row.name || row)).filter(Boolean);
  const free = String(freeText || "").trim();
  const parts = [...sins];
  if (free && !sins.some((item) => free.toLowerCase().includes(item.toLowerCase()))) {
    parts.push(free);
  }
  return parts.join(", ");
}

export function needsCustomize(productId, extras, groups, removable) {
  return Boolean(
    (extras || []).length || (groups || []).length || removableForProduct(removable, productId).length,
  );
}
