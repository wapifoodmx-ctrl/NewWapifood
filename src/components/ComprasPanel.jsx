"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { money } from "@/lib/format";

const emptyLine = () => ({ ingredient_id: "", qty: "1", unit_cost: "" });

export function ComprasPanel({ restaurantId }) {
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const names = useMemo(
    () => Object.fromEntries(ingredients.map((item) => [item.id, item])),
    [ingredients],
  );

  async function load() {
    const supabase = createClient();
    const [{ data: people }, { data: stock }, { data: buys }] = await Promise.all([
      supabase.from("suppliers").select("id,name,phone").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
      supabase.from("ingredients").select("id,name,unit,stock,cost").eq("restaurant_id", restaurantId).order("name"),
      supabase.from("purchases").select("id,supplier_id,note,total,bought_at,purchase_lines(qty,unit_cost,line_total,ingredient_id)").eq("restaurant_id", restaurantId).order("bought_at", { ascending: false }).limit(12),
    ]);
    setSuppliers(people || []);
    setIngredients(stock || []);
    setPurchases(buys || []);
  }

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("suppliers").select("id,name,phone").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
      supabase.from("ingredients").select("id,name,unit,stock,cost").eq("restaurant_id", restaurantId).order("name"),
      supabase.from("purchases").select("id,supplier_id,note,total,bought_at,purchase_lines(qty,unit_cost,line_total,ingredient_id)").eq("restaurant_id", restaurantId).order("bought_at", { ascending: false }).limit(12),
    ]).then(([people, stock, buys]) => {
      setSuppliers(people.data || []);
      setIngredients(stock.data || []);
      setPurchases(buys.data || []);
    });
  }, [restaurantId]);

  async function addSupplier(event) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Escribe el nombre del proveedor");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("save_supplier", {
      p_restaurant: restaurantId,
      p_name: name.trim(),
      p_phone: phone.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    setPhone("");
    toast.success("Proveedor guardado");
    await load();
  }

  async function savePurchase(event) {
    event.preventDefault();
    const payload = lines
      .filter((line) => line.ingredient_id)
      .map((line) => ({
        ingredient_id: line.ingredient_id,
        qty: Number(line.qty),
        unit_cost: Number(line.unit_cost),
      }));
    if (!payload.length) return toast.error("Agrega al menos un insumo");
    if (payload.some((line) => !line.qty || line.qty <= 0 || Number.isNaN(line.unit_cost) || line.unit_cost < 0)) {
      return toast.error("Revisa cantidad y costo");
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("record_purchase", {
      p_restaurant: restaurantId,
      p_supplier: supplierId || null,
      p_note: note.trim() || null,
      p_lines: payload,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setLines([emptyLine()]);
    setNote("");
    toast.success("Compra registrada. El costo del insumo quedó como promedio de lo que había y lo que llegó.");
    await load();
  }

  const supplierName = Object.fromEntries(suppliers.map((item) => [item.id, item.name]));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="text-2xl">Proveedores</h2>
        <form className="mt-3 grid gap-2" onSubmit={addSupplier}>
          <input className="h-12 border px-3" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="h-12 border px-3" placeholder="Teléfono, si lo tienes" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button type="submit" className="btn-primary h-12" disabled={busy}>Guardar proveedor</button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {suppliers.map((item) => (
            <li key={item.id}>{item.name}{item.phone ? ` · ${item.phone}` : ""}</li>
          ))}
          {!suppliers.length ? <li className="text-[var(--ink-soft)]">Todavía no hay proveedores.</li> : null}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-2xl">Registrar compra</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">La cantidad y el costo van en la unidad del inventario. El costo nuevo es el promedio de lo que ya había y esta compra.</p>
        <form className="mt-3 grid gap-2" onSubmit={savePurchase}>
          <select className="h-12 border px-3" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-3">
              <select className="h-12 border px-2" value={line.ingredient_id} onChange={(e) => setLines((rows) => rows.map((row, i) => i === index ? { ...row, ingredient_id: e.target.value } : row))}>
                <option value="">Insumo</option>
                {ingredients.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
              </select>
              <input className="h-12 border px-3" inputMode="decimal" placeholder="Cantidad" value={line.qty} onChange={(e) => setLines((rows) => rows.map((row, i) => i === index ? { ...row, qty: e.target.value } : row))} />
              <input className="h-12 border px-3" inputMode="decimal" placeholder="Costo por unidad" value={line.unit_cost} onChange={(e) => setLines((rows) => rows.map((row, i) => i === index ? { ...row, unit_cost: e.target.value } : row))} />
            </div>
          ))}
          <button type="button" className="btn-ghost h-11" onClick={() => setLines((rows) => [...rows, emptyLine()])}>Otro insumo</button>
          <input className="h-12 border px-3" placeholder="Nota, si hace falta" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="btn-primary h-12" disabled={busy}>Guardar compra y subir stock</button>
        </form>
      </section>

      <section className="card p-5 lg:col-span-2">
        <h2 className="text-2xl">Últimas compras</h2>
        <ul className="mt-3 space-y-3">
          {purchases.map((buy) => (
            <li key={buy.id} className="border-b pb-2">
              <p className="font-semibold">{supplierName[buy.supplier_id] || "Sin proveedor"} · {money(buy.total)}</p>
              <p className="text-sm text-[var(--ink-soft)]">{new Date(buy.bought_at).toLocaleString("es-MX")}{buy.note ? ` · ${buy.note}` : ""}</p>
              <p className="text-sm">{(buy.purchase_lines || []).map((line) => `${names[line.ingredient_id]?.name || "Insumo"} ${line.qty}`).join(", ")}</p>
            </li>
          ))}
          {!purchases.length ? <li className="text-[var(--ink-soft)]">Todavía no hay compras.</li> : null}
        </ul>
      </section>
    </div>
  );
}
