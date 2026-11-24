/** Carta y carrito del celular en la mesa. No cobra: caja acepta el pedido. */

export function categoryName(product) {
  const name = String(product?.category || "").trim();
  return name || "Otros";
}

export function menuCategories(products) {
  return (products || []).reduce((names, product) => {
    const name = categoryName(product);
    return names.includes(name) ? names : [...names, name];
  }, []);
}

export function productsInCategory(products, category) {
  if (!category) return products || [];
  return (products || []).filter((product) => categoryName(product) === category);
}

export function modifierIssue(groups, selected) {
  for (const group of groups || []) {
    const count = (selected || []).filter((item) => item.group_id === group.group_id).length;
    const min = group.required ? Math.max(Number(group.min) || 0, 1) : Number(group.min) || 0;
    const max = group.max == null || group.max === "" ? null : Number(group.max);
    if (count < min) return `En ${group.group} elige al menos ${min}.`;
    if (max != null && count > max) return `En ${group.group} el máximo es ${max}.`;
  }
  return "";
}

export function toggleTableModifier(selected, option, group) {
  const current = selected || [];
  const on = current.some((item) => item.option_id === option.id);
  if (on) return current.filter((item) => item.option_id !== option.id);
  const max = group?.max == null || group.max === "" ? null : Number(group.max);
  const sameGroup = current.filter((item) => item.group_id === group.group_id);
  if (max === 1) {
    return [
      ...current.filter((item) => item.group_id !== group.group_id),
      picked(option, group),
    ];
  }
  if (max != null && sameGroup.length >= max) return current;
  return [...current, picked(option, group)];
}

function picked(option, group) {
  return {
    option_id: option.id,
    group_id: group.group_id,
    name: option.name,
    extra_price: Number(option.price) || 0,
  };
}

export function addCartLine(cart, line) {
  const notes = line.notes || "";
  const modKey = line.modKey || "";
  const qty = line.qty || 1;
  const found = (cart || []).some(
    (row) => row.product_id === line.product_id && (row.notes || "") === notes && (row.modKey || "") === modKey,
  );
  if (!found) return [...(cart || []), { ...line, qty, notes, modKey }];
  return (cart || []).map((row) =>
    row.product_id === line.product_id && (row.notes || "") === notes && (row.modKey || "") === modKey
      ? { ...row, qty: row.qty + qty }
      : row,
  );
}

export function changeQty(cart, index, delta) {
  return (cart || [])
    .map((row, i) => (i === index ? { ...row, qty: row.qty + delta } : row))
    .filter((row) => row.qty > 0);
}

export function changeRequestQty(items, index, delta) {
  return (items || [])
    .map((row, i) => {
      if (i !== index) return row;
      const next = Math.min(20, Math.max(0, Number(row.qty || 1) + delta));
      return { ...row, qty: next };
    })
    .filter((row) => row.qty > 0);
}

export function requestPayload(items) {
  return (items || []).map((row) => ({
    product_id: row.product_id,
    qty: Math.min(20, Math.max(1, Number(row.qty) || 1)),
    notes: row.notes || "",
    modifiers: (row.modifiers || [])
      .map((mod) => ({ option_id: mod.option_id }))
      .filter((mod) => mod.option_id),
  }));
}

export function lineTotal(row) {
  const extras = (row?.modifiers || []).reduce((sum, item) => sum + Number(item.extra_price || item.price || 0), 0);
  return (Number(row?.price) + extras) * Number(row?.qty || 0);
}

export function cartTotal(cart) {
  return (cart || []).reduce((sum, row) => sum + lineTotal(row), 0);
}

export function cartCount(cart) {
  return (cart || []).reduce((sum, row) => sum + Number(row.qty || 0), 0);
}

export function billLineTotal(item) {
  const extras = (item?.extras || []).reduce((sum, extra) => sum + Number(extra.extra_price || 0), 0);
  return (Number(item?.price) + extras) * Number(item?.qty || 0);
}

export function itemWord(status) {
  if (status === "preparado") return { word: "Listo", tone: "ok" };
  if (status === "cancelado") return { word: "Cancelado", tone: "bad" };
  return { word: "En cocina", tone: "warn" };
}

export function requestWord(kind) {
  if (kind === "mesero") return { word: "Aviso enviado", text: "El mesero ya fue avisado." };
  if (kind === "cuenta") return { word: "Cuenta pedida", text: "Caja ya sabe que quieres pagar. El cobro es en la mesa." };
  return { word: "En revisión", text: "Caja está revisando este pedido." };
}

export function rejectedText(reason) {
  const clean = String(reason || "").trim();
  return clean || "Caja no pudo tomar este pedido. Puedes pedir otra cosa.";
}

export function sendNote(accepted) {
  return accepted
    ? "Pedido enviado a cocina."
    : "Pedido enviado. Caja lo revisa antes de prepararlo.";
}

export function requestItemNames(items) {
  return (items || [])
    .map((item) => {
      const name = String(item?.name || "").trim();
      if (!name) return "";
      return `${Number(item.qty) || 1} × ${name}`;
    })
    .filter(Boolean);
}
