"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

export function ModificadoresPanel({ restaurantId, products, initialGroups = [], initialOptions = [], initialLinks = [] }) {
  const [groups, setGroups] = useState(initialGroups);
  const [options, setOptions] = useState(initialOptions);
  const [links, setLinks] = useState(initialLinks);
  const [name, setName] = useState("");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("1");
  const [required, setRequired] = useState(false);
  const [optionName, setOptionName] = useState("");
  const [optionPrice, setOptionPrice] = useState("0");
  const [groupId, setGroupId] = useState(initialGroups[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");

  async function addGroup(event) {
    event.preventDefault();
    const minSelect = Number(min) || 0;
    const maxSelect = Number(max) || 1;
    if (!name.trim()) return toast.error("Ponle nombre al grupo");
    if (maxSelect < 1 || maxSelect < minSelect) return toast.error("El máximo tiene que ser al menos el mínimo");
    const supabase = createClient();
    const { data, error } = await supabase.from("modifier_groups").insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      min_select: required ? Math.max(minSelect, 1) : minSelect,
      max_select: maxSelect,
      required,
    }).select("id,name,min_select,max_select,required").single();
    if (error) return toast.error(error.message);
    setGroups((rows) => [...rows, data]);
    setGroupId(data.id);
    setName("");
    toast.success("Grupo guardado");
  }

  async function addOption(event) {
    event.preventDefault();
    if (!groupId || !optionName.trim()) return toast.error("Elige grupo y nombre");
    const supabase = createClient();
    const { data, error } = await supabase.from("modifier_options").insert({
      group_id: groupId,
      name: optionName.trim(),
      extra_price: Number(optionPrice) || 0,
    }).select("id,group_id,name,extra_price").single();
    if (error) return toast.error(error.message);
    setOptions((rows) => [...rows, data]);
    setOptionName("");
    toast.success("Opción guardada");
  }

  async function attach(event) {
    event.preventDefault();
    if (!productId || !groupId) return toast.error("Elige platillo y grupo");
    const supabase = createClient();
    const { error } = await supabase.from("product_modifier_groups").insert({ product_id: productId, group_id: groupId });
    if (error) return toast.error(error.message);
    setLinks((rows) => [...rows, { product_id: productId, group_id: groupId }]);
    toast.success("El grupo ya sale al pedir ese platillo");
  }

  return (
    <section className="card mt-6 p-5">
      <h2 className="text-2xl">Modificadores</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Por ejemplo, término de la carne. Puedes pedir un mínimo, un máximo y que sea obligatorio.</p>
      <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={addGroup}>
        <input className="h-12 border px-3" placeholder="Nombre del grupo" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Obligatorio</label>
        <input className="h-12 border px-3" inputMode="numeric" placeholder="Mínimo" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} />
        <input className="h-12 border px-3" inputMode="numeric" placeholder="Máximo" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} />
        <button type="submit" className="btn-primary h-12 sm:col-span-2">Guardar grupo</button>
      </form>
      <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={addOption}>
        <select className="h-12 border px-2" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Grupo</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <input className="h-12 border px-3" placeholder="Opción" value={optionName} onChange={(e) => setOptionName(e.target.value)} />
        <input className="h-12 border px-3" inputMode="decimal" placeholder="Precio extra" value={optionPrice} onChange={(e) => setOptionPrice(e.target.value)} />
        <button type="submit" className="btn-ghost h-12 sm:col-span-3">Agregar opción</button>
      </form>
      <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={attach}>
        <select className="h-12 border px-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <select className="h-12 border px-2" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <button type="submit" className="btn-primary h-12">Poner en el platillo</button>
      </form>
      <ul className="mt-4 space-y-2 text-sm">
        {groups.map((group) => (
          <li key={group.id}>
            <strong>{group.name}</strong> · {group.required ? "obligatorio" : "opcional"} · {group.min_select} a {group.max_select}
            <span className="block text-[var(--ink-soft)]">{options.filter((option) => option.group_id === group.id).map((option) => option.name).join(", ") || "Sin opciones"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
