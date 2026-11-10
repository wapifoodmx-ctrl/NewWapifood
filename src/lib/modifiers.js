export function modifierError(groups, selected) {
  for (const group of groups || []) {
    const count = (selected || []).filter((item) => item.group_id === group.id).length;
    const min = group.required ? Math.max(Number(group.min_select) || 0, 1) : Number(group.min_select) || 0;
    const max = Number(group.max_select) || 1;
    if (count < min) return `En ${group.name} elige al menos ${min}.`;
    if (count > max) return `En ${group.name} el máximo es ${max}.`;
  }
  return "";
}

export function toggleModifier(groups, selected, option) {
  const group = (groups || []).find((item) => item.id === option.group_id);
  const on = (selected || []).some((item) => item.option_id === option.option_id);
  if (on) return selected.filter((item) => item.option_id !== option.option_id);
  const without = (selected || []).filter((item) => group?.max_select === 1 ? item.group_id !== option.group_id : true);
  const count = without.filter((item) => item.group_id === option.group_id).length;
  if (group && count >= Number(group.max_select || 1)) return selected;
  return [...without, option];
}

export function groupsForProduct(groups, links, productId) {
  const ids = new Set((links || []).filter((link) => link.product_id === productId).map((link) => link.group_id));
  return (groups || []).filter((group) => ids.has(group.id));
}
