"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const empty = { name: "", unit: "pza", stock: "0", min_stock: "0" };

export function InsumosManager({ restaurantId, initialIngredients }) {
  const [items, setItems] = useState(initialIngredients);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  function startEdit(i) {
    setEditingId(i.id);
    setForm({
      name: i.name,
      unit: i.unit || "pza",
      stock: String(i.stock ?? 0),
      min_stock: String(i.min_stock ?? 0),
    });
  }

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!form.name.trim()) return setErr("Nombre obligatorio");
    const stock = Number(form.stock);
    const min_stock = Number(form.min_stock);
    if (Number.isNaN(stock) || stock < 0) return setErr("Stock inválido");
    if (Number.isNaN(min_stock) || min_stock < 0) return setErr("Mínimo inválido");

    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      unit: form.unit || "pza",
      stock,
      min_stock,
    };

    try {
      if (editingId) {
        const { data, error } = await supabase.from("ingredients").update(payload).eq("id", editingId).select("*").single();
        if (error) throw error;
        setItems((xs) => xs.map((x) => (x.id === editingId ? data : x)));
        setMsg("Insumo actualizado");
      } else {
        const { data, error } = await supabase.from("ingredients").insert(payload).select("*").single();
        if (error) throw error;
        setItems((xs) => [data, ...xs]);
        setMsg("Insumo creado");
      }
      setEditingId(null);
      setForm(empty);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function restock(id, unit) {
    const qty = unit === "g" || unit === "ml" ? 200 : 10;
    const supabase = createClient();
    const row = items.find((i) => i.id === id);
    const { data, error } = await supabase
      .from("ingredients")
      .update({ stock: Number(row.stock) + qty })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setItems((xs) => xs.map((x) => (x.id === id ? data : x)));
  }

  async function remove(id) {
    if (!confirm("¿Eliminar insumo?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) return setErr(error.message);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((ing) => {
          const low = Number(ing.stock) <= Number(ing.min_stock);
          return (
            <article key={ing.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl">{ing.name}</h3>
                  <p className="text-sm text-[var(--color-muted)]">mín. {ing.min_stock} {ing.unit}</p>
                </div>
                <p className={`text-2xl font-semibold ${low ? "text-[var(--color-wine)]" : ""}`}>
                  {ing.stock}<span className="ml-1 text-sm font-normal text-[var(--color-muted)]">{ing.unit}</span>
                </p>
              </div>
              {low ? <p className="mt-1 text-sm font-semibold text-[var(--color-wine)]">Bajo mínimo</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => restock(ing.id, ing.unit)} className="h-9 rounded-full bg-[var(--color-cream)] px-3 text-sm font-semibold">Entrada</button>
                <button type="button" onClick={() => startEdit(ing)} className="h-9 rounded-full px-3 text-sm font-semibold text-[var(--color-ember)]">Editar</button>
                <button type="button" onClick={() => remove(ing.id)} className="h-9 rounded-full px-3 text-sm font-semibold text-[var(--color-wine)]">Eliminar</button>
              </div>
            </article>
          );
        })}
        {items.length === 0 ? <p className="text-[var(--color-muted)]">Sin insumos. Crea el primero.</p> : null}
      </div>

      <form onSubmit={onSave} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <h3 className="text-lg font-semibold">{editingId ? "Editar insumo" : "Nuevo insumo"}</h3>
        <label className="mt-3 block text-sm font-semibold">Nombre *
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
        </label>
        <label className="mt-2 block text-sm font-semibold">Unidad
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal">
            <option value="pza">pza</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="l">l</option>
          </select>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block text-sm font-semibold">Stock
            <input type="number" min="0" step="0.01" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
          </label>
          <label className="block text-sm font-semibold">Mínimo
            <input type="number" min="0" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
          </label>
        </div>
        {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
        {msg ? <p className="mt-2 text-sm text-[var(--color-sage)]">{msg}</p> : null}
        <div className="mt-3 flex gap-2">
          <button type="submit" className="h-11 flex-1 rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]">{editingId ? "Actualizar" : "Crear"}</button>
          {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(empty); }} className="h-11 rounded-full border border-[var(--color-line)] px-4 text-sm font-semibold">Cancelar</button> : null}
        </div>
      </form>
    </div>
  );
}
