"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const empty = {
  name: "",
  unit: "pza",
  stock: "0",
  min_stock: "0",
  kind: "no_perecedero",
  expires_on: "",
  notes: "",
};

const KINDS = [
  { id: "perecedero", label: "Perecedero" },
  { id: "no_perecedero", label: "No perecedero" },
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const end = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((end - now) / 86400000);
}

export function InsumosManager({ restaurantId, initialIngredients }) {
  const [items, setItems] = useState(initialIngredients);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const list = useMemo(() => {
    if (filter === "todos") return items;
    if (filter === "bajo") {
      return items.filter((i) => Number(i.stock) <= Number(i.min_stock));
    }
    if (filter === "por_caducar") {
      return items.filter((i) => {
        if (i.kind !== "perecedero" || !i.expires_on) return false;
        const d = daysUntil(i.expires_on);
        return d != null && d <= 7;
      });
    }
    return items.filter((i) => i.kind === filter);
  }, [items, filter]);

  function startEdit(i) {
    setEditingId(i.id);
    setForm({
      name: i.name,
      unit: i.unit || "pza",
      stock: String(i.stock ?? 0),
      min_stock: String(i.min_stock ?? 0),
      kind: i.kind || "no_perecedero",
      expires_on: i.expires_on || "",
      notes: i.notes || "",
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
    if (form.kind === "perecedero" && form.expires_on) {
      /* ok */
    }

    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      unit: form.unit || "pza",
      stock,
      min_stock,
      kind: form.kind || "no_perecedero",
      expires_on: form.kind === "perecedero" && form.expires_on ? form.expires_on : null,
      notes: form.notes?.trim() || null,
    };

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from("ingredients")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single();
        if (error) throw error;
        setItems((xs) => xs.map((x) => (x.id === editingId ? data : x)));
        setMsg("Insumo actualizado");
      } else {
        const { data, error } = await supabase
          .from("ingredients")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        setItems((xs) => [data, ...xs]);
        setMsg("Insumo creado");
      }
      setEditingId(null);
      setForm(empty);
    } catch (e2) {
      setErr(e2.message + (e2.message?.includes("kind") ? " — ¿corriste SQL 015?" : ""));
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

  async function merma(id) {
    const raw = prompt("Cantidad a dar de merma:", "1");
    if (raw == null) return;
    const qty = Number(raw);
    if (!qty || qty <= 0) return setErr("Cantidad de merma inválida");
    const supabase = createClient();
    const { error } = await supabase.rpc("register_merma", {
      p_ingredient: id,
      p_qty: qty,
      p_note: "merma",
    });
    if (error) {
      // fallback local si no hay RPC
      const row = items.find((i) => i.id === id);
      const { data, error: e2 } = await supabase
        .from("ingredients")
        .update({ stock: Math.max(0, Number(row.stock) - qty) })
        .eq("id", id)
        .select("*")
        .single();
      if (e2) return setErr(error.message);
      setItems((xs) => xs.map((x) => (x.id === id ? data : x)));
    } else {
      const row = items.find((i) => i.id === id);
      setItems((xs) =>
        xs.map((x) =>
          x.id === id ? { ...x, stock: Math.max(0, Number(x.stock) - qty) } : x,
        ),
      );
      setMsg(`Merma registrada${row ? ` en ${row.name}` : ""}`);
    }
  }

  const filters = [
    { id: "todos", label: "Todos" },
    { id: "perecedero", label: "Perecederos" },
    { id: "no_perecedero", label: "No perecederos" },
    { id: "bajo", label: "Stock bajo" },
    { id: "por_caducar", label: "Por caducar (7d)" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`h-9 rounded-[3px] px-3 text-[11px] font-semibold uppercase tracking-wide ${
                filter === f.id
                  ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                  : "bg-[var(--color-paper)] text-[var(--color-onyx-warm)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((ing) => {
            const low = Number(ing.stock) <= Number(ing.min_stock);
            const d = daysUntil(ing.expires_on);
            const expiring = ing.kind === "perecedero" && d != null && d <= 7;
            const expired = d != null && d < 0;
            return (
              <article
                key={ing.id}
                className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-normal">{ing.name}</h3>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-saffron-glow)]">
                      {ing.kind === "perecedero" ? "Perecedero" : "No perecedero"}
                    </p>
                    <p className="text-sm text-[var(--color-espresso)]">
                      mín. {ing.min_stock} {ing.unit}
                    </p>
                    {ing.expires_on ? (
                      <p
                        className={`text-xs ${
                          expired
                            ? "text-[var(--color-wine)]"
                            : expiring
                              ? "text-[var(--color-saffron-glow)]"
                              : "text-[var(--color-walnut)]"
                        }`}
                      >
                        Caduca: {ing.expires_on}
                        {d != null ? (expired ? " (vencido)" : ` (${d}d)`) : ""}
                      </p>
                    ) : null}
                  </div>
                  <p className={`text-2xl font-semibold ${low ? "text-[var(--color-wine)]" : ""}`}>
                    {ing.stock}
                    <span className="ml-1 text-sm font-normal text-[var(--color-espresso)]">
                      {ing.unit}
                    </span>
                  </p>
                </div>
                {low ? (
                  <p className="mt-2 text-xs font-semibold text-[var(--color-wine)]">Stock bajo</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEdit(ing)} className="text-xs font-semibold">
                    Editar
                  </button>
                  <button type="button" onClick={() => restock(ing.id, ing.unit)} className="text-xs font-semibold">
                    + entrada
                  </button>
                  <button type="button" onClick={() => merma(ing.id)} className="text-xs font-semibold">
                    Merma
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(ing.id)}
                    className="text-xs font-semibold text-[var(--color-wine)]"
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
          {list.length === 0 ? (
            <p className="col-span-full border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5 text-[var(--color-espresso)]">
              No hay insumos en este filtro.
            </p>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={onSave}
        className="h-fit border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4"
      >
        <h2 className="text-xl font-normal">{editingId ? "Editar insumo" : "Nuevo insumo"}</h2>
        <label className="wf-label mt-3">
          Nombre
          <input
            className="wf-input mt-1"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="wf-label mt-2">
          Tipo
          <select
            className="wf-input mt-1"
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="wf-label">
            Unidad
            <select
              className="wf-input mt-1"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            >
              <option value="pza">pza</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="l">l</option>
              <option value="ml">ml</option>
            </select>
          </label>
          <label className="wf-label">
            Stock
            <input
              className="wf-input mt-1"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            />
          </label>
          <label className="wf-label">
            Mínimo
            <input
              className="wf-input mt-1"
              value={form.min_stock}
              onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))}
            />
          </label>
          {form.kind === "perecedero" ? (
            <label className="wf-label">
              Caducidad
              <input
                type="date"
                className="wf-input mt-1"
                value={form.expires_on}
                onChange={(e) => setForm((f) => ({ ...f, expires_on: e.target.value }))}
              />
            </label>
          ) : null}
        </div>
        <label className="wf-label mt-2">
          Notas
          <input
            className="wf-input mt-1"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Proveedor, lote…"
          />
        </label>
        {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
        {msg ? <p className="mt-2 text-sm text-[var(--color-sage)]">{msg}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="submit" className="wf-btn wf-btn-primary flex-1">
            {editingId ? "Guardar" : "Crear"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="wf-btn border border-[var(--color-warm-stone)] px-3"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
              }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
