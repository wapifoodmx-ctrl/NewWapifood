"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { money } from "@/lib/format";
import { uploadPublicImage } from "@/lib/storage";

const emptyProduct = {
  name: "",
  description: "",
  price: "",
  cost: "",
  category_id: "",
  active: true,
  image_url: "",
};

export function CartaManager({ restaurantId, initialProducts, initialCategories }) {
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [newCat, setNewCat] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const catName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id) => m.get(id) || "Sin categoría";
  }, [categories]);

  const list = products.filter((p) => {
    if (catFilter && p.category_id !== catFilter) return false;
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  async function addCategory(e) {
    e.preventDefault();
    if (!newCat.trim()) return;
    setErr("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .insert({ restaurant_id: restaurantId, name: newCat.trim() })
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setCategories((c) => [...c, data]);
    setNewCat("");
    setMsg("Categoría creada");
    toast.success("Categoría creada");
    toast.success("Categoría creada");
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      description: p.description || "",
      price: String(p.price ?? ""),
      cost: String(p.cost ?? ""),
      category_id: p.category_id || "",
      active: p.active !== false,
      image_url: p.image_url || "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyProduct);
  }

  async function onImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const url = await uploadPublicImage(supabase, restaurantId, file, "products");
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e2) {
      setErr(e2.message || "Error al subir imagen");
    } finally {
      setLoading(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!form.name.trim()) return setErr("El nombre es obligatorio.");
    const price = Number(form.price);
    const cost = Number(form.cost || 0);
    if (Number.isNaN(price) || price < 0) return setErr("Precio inválido.");
    if (Number.isNaN(cost) || cost < 0) return setErr("Costo inválido.");

    setLoading(true);
    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description || null,
      price,
      cost,
      category_id: form.category_id || null,
      active: form.active,
      image_url: form.image_url || null,
    };

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single();
        if (error) throw error;
        setProducts((ps) => ps.map((p) => (p.id === editingId ? data : p)));
        setMsg("Producto actualizado");
      toast.success("Producto actualizado");
      toast.success("Producto actualizado");
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("*").single();
        if (error) throw error;
        setProducts((ps) => [data, ...ps]);
        setMsg("Producto creado");
      toast.success("Producto creado");
      toast.success("Producto creado");
      }
      resetForm();
    } catch (e3) {
      setErr(e3.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(p) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .update({ active: !p.active })
      .eq("id", p.id)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setProducts((ps) => ps.map((x) => (x.id === p.id ? data : x)));
  }

  async function removeProduct(id) {
    if (!(await confirmAsync("¿Eliminar este producto?", { title: "Eliminar producto" }))) return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return setErr(error.message);
    setProducts((ps) => ps.filter((p) => p.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar producto…"
            className="h-11 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3"
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-11 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)]">
          {list.length === 0 ? (
            <p className="p-5 text-[var(--color-muted)]">No hay productos. Crea el primero →</p>
          ) : (
            list.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-0">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-cream)]">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {catName(p.category_id)} · {p.active ? "Activo" : "Inactivo"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(p.price)}</p>
                  <p className="text-xs text-[var(--color-muted)]">costo {money(p.cost)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => startEdit(p)} className="text-xs font-semibold text-[var(--color-ember)]">Editar</button>
                  <button type="button" onClick={() => toggleActive(p)} className="text-xs font-semibold">{p.active ? "Pausar" : "Activar"}</button>
                  <button type="button" onClick={() => removeProduct(p.id)} className="text-xs font-semibold text-[var(--color-wine)]">Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <form onSubmit={addCategory} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <h3 className="text-lg font-semibold">Nueva categoría</h3>
          <div className="mt-2 flex gap-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ej. Tacos" className="h-11 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3" />
            <button type="submit" className="h-11 rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">Añadir</button>
          </div>
        </form>

        <form onSubmit={onSave} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <h3 className="text-lg font-semibold">{editingId ? "Editar producto" : "Nuevo producto"}</h3>
          <label className="mt-3 block text-sm font-semibold">
            Nombre *
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
          </label>
          <label className="mt-2 block text-sm font-semibold">
            Descripción
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 py-2 font-normal" />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-sm font-semibold">
              Precio *
              <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
            </label>
            <label className="block text-sm font-semibold">
              Costo
              <input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
            </label>
          </div>
          <label className="mt-2 block text-sm font-semibold">
            Categoría
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal">
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Activo en menú
          </label>
          <label className="mt-2 inline-flex h-10 cursor-pointer items-center rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">
            {form.image_url ? "Cambiar foto" : "Subir foto"}
            <input type="file" accept="image/*" className="hidden" onChange={onImage} />
          </label>
          {form.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image_url} alt="" className="mt-2 h-20 w-20 rounded-lg object-cover" />
          ) : null}
          {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
          {msg ? <p className="mt-2 text-sm text-[var(--color-sage)]">{msg}</p> : null}
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={loading} className="h-11 flex-1 rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)] disabled:opacity-60">
              {loading ? "…" : editingId ? "Actualizar" : "Crear"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="h-11 rounded-full border border-[var(--color-line)] px-4 text-sm font-semibold">
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
