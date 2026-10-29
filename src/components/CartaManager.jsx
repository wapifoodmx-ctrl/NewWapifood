"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
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

/**
 * Carta admin — paridad gradual con pages/menu.js del WapifoodFront:
 * categorías de primera clase + productos + foto + atajo a recetas.
 */
export function CartaManager({ restaurantId, initialProducts, initialCategories }) {
  const [tab, setTab] = useState("productos"); // productos | categorias
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(
    [...initialCategories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
  );
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [newCat, setNewCat] = useState("");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const catName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id) => m.get(id) || "Sin categoría";
  }, [categories]);

  const productCountByCat = useMemo(() => {
    const m = {};
    for (const p of products) {
      const k = p.category_id || "_none";
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [products]);

  const list = products.filter((p) => {
    if (onlyActive && p.active === false) return false;
    if (catFilter && p.category_id !== catFilter) return false;
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  async function addCategory(e) {
    e.preventDefault();
    if (!newCat.trim()) return;
    setErr("");
    setLoading(true);
    const supabase = createClient();
    const sort_order = categories.length;
    const { data, error } = await supabase
      .from("categories")
      .insert({ restaurant_id: restaurantId, name: newCat.trim(), sort_order })
      .select("*")
      .single();
    setLoading(false);
    if (error) {
      setErr(error.message);
      toast.error(error.message);
      return;
    }
    setCategories((c) => [...c, data]);
    setNewCat("");
    toast.success("Categoría creada");
  }

  async function saveCategoryName(id) {
    if (!editCatName.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .update({ name: editCatName.trim() })
      .eq("id", id)
      .select("*")
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((cs) => cs.map((c) => (c.id === id ? data : c)));
    setEditCatId(null);
    toast.success("Categoría actualizada");
  }

  async function deleteCategory(cat) {
    const count = productCountByCat[cat.id] || 0;
    if (count > 0) {
      toast.warning(`No se puede borrar: hay ${count} producto(s) en esta categoría.`);
      return;
    }
    if (!(await confirmAsync(`¿Eliminar la categoría "${cat.name}"?`, { title: "Eliminar categoría" }))) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((cs) => cs.filter((c) => c.id !== cat.id));
    if (catFilter === cat.id) setCatFilter("");
    toast.success("Categoría eliminada");
  }

  async function moveCategory(cat, dir) {
    const sorted = [...categories].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
    );
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    const supabase = createClient();
    const orderA = b.sort_order ?? swap;
    const orderB = a.sort_order ?? idx;
    const { error: e1 } = await supabase.from("categories").update({ sort_order: orderA }).eq("id", a.id);
    const { error: e2 } = await supabase.from("categories").update({ sort_order: orderB }).eq("id", b.id);
    if (e1 || e2) {
      toast.error((e1 || e2).message + " — ¿corriste SQL 019?");
      return;
    }
    setCategories((cs) =>
      cs.map((c) => {
        if (c.id === a.id) return { ...c, sort_order: orderA };
        if (c.id === b.id) return { ...c, sort_order: orderB };
        return c;
      }),
    );
  }

  function startEdit(p) {
    setTab("productos");
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
      toast.success("Foto lista. Guarda el producto.");
    } catch (e2) {
      toast.error(e2.message || "No se pudo subir la imagen");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) {
      setErr("El nombre es obligatorio.");
      toast.error("El nombre es obligatorio.");
      return;
    }
    const price = Number(form.price);
    const cost = Number(form.cost || 0);
    if (Number.isNaN(price) || price < 0) {
      setErr("Precio inválido.");
      toast.error("Precio inválido.");
      return;
    }
    if (Number.isNaN(cost) || cost < 0) {
      setErr("Costo inválido.");
      toast.error("Costo inválido.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
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
        toast.success("Producto actualizado");
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("*").single();
        if (error) throw error;
        setProducts((ps) => [data, ...ps]);
        toast.success("Producto creado");
      }
      resetForm();
    } catch (e3) {
      setErr(e3.message || "No se pudo guardar");
      toast.error(e3.message || "No se pudo guardar");
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
    if (error) {
      toast.error(error.message);
      return;
    }
    setProducts((ps) => ps.map((x) => (x.id === p.id ? data : x)));
    toast.info(data.active ? "Producto activo en el menú" : "Producto oculto del menú");
  }

  async function removeProduct(id) {
    if (!(await confirmAsync("¿Eliminar este producto? Esta acción no se puede deshacer.", { title: "Eliminar producto" }))) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProducts((ps) => ps.filter((p) => p.id !== id));
    if (editingId === id) resetForm();
    toast.success("Producto eliminado");
  }

  const sortedCats = [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
  );

  return (
    <div className="relative">
      <LoadingOverlay visible={loading} message="Procesando carta…" />

      <div className="mb-4 flex flex-wrap gap-1">
        {[
          { id: "productos", label: "Productos" },
          { id: "categorias", label: "Categorías" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`h-10 rounded-[3px] px-4 text-xs font-semibold uppercase tracking-wide ${
              tab === t.id
                ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                : "bg-[var(--color-paper)] text-[var(--color-onyx-warm)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "categorias" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-2">
            {sortedCats.map((c, i) => (
              <article
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  {editCatId === c.id ? (
                    <input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="h-10 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
                    />
                  ) : (
                    <>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-[var(--color-walnut)]">
                        {productCountByCat[c.id] || 0} producto(s)
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="text-xs font-semibold" onClick={() => moveCategory(c, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold"
                    onClick={() => moveCategory(c, 1)}
                    disabled={i === sortedCats.length - 1}
                  >
                    ↓
                  </button>
                  {editCatId === c.id ? (
                    <button type="button" className="text-xs font-semibold" onClick={() => saveCategoryName(c.id)}>
                      Guardar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs font-semibold"
                      onClick={() => {
                        setEditCatId(c.id);
                        setEditCatName(c.name);
                      }}
                    >
                      Renombrar
                    </button>
                  )}
                  <button type="button" className="text-xs font-semibold" onClick={() => { setCatFilter(c.id); setTab("productos"); }}>
                    Ver productos
                  </button>
                  <button type="button" className="text-xs font-semibold text-[var(--color-wine)]" onClick={() => deleteCategory(c)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
            {!sortedCats.length ? (
              <p className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5 text-[var(--color-espresso)]">
                Aún no hay categorías. Créalas primero: arman el menú.
              </p>
            ) : null}
          </div>
          <form onSubmit={addCategory} className="h-fit border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
            <h2 className="text-xl font-normal">Nueva categoría</h2>
            <p className="mt-1 text-sm text-[var(--color-espresso)]">
              Las categorías organizan la carta en POS, mesero, QR y kiosko.
            </p>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Ej. Tacos, Bebidas…"
              className="mt-3 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3"
            />
            <button type="submit" className="mt-3 h-11 w-full rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]">
              Crear categoría
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar producto…"
                className="h-10 min-w-[160px] flex-1 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-3 text-sm"
              />
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="h-10 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-2 text-sm"
              >
                <option value="">Todas las categorías</option>
                {sortedCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label className="flex h-10 items-center gap-2 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-3 text-xs font-semibold">
                <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
                Solo activos
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => (
                <article
                  key={p.id}
                  className={`border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4 ${
                    p.active === false ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-16 w-16 shrink-0 object-cover" />
                    ) : (
                      <div className="grid h-16 w-16 shrink-0 place-items-center bg-[var(--color-parchment)] text-[10px] text-[var(--color-walnut)]">
                        Sin foto
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-saffron-glow)]">
                        {catName(p.category_id)}
                      </p>
                      <h3 className="truncate text-lg font-normal">{p.name}</h3>
                      <p className="text-sm text-[var(--color-espresso)]">
                        {money(p.price)}
                        {p.cost != null ? ` · costo ${money(p.cost)}` : ""}
                      </p>
                      {p.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-walnut)]">{p.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(p)} className="text-xs font-semibold">
                      Editar
                    </button>
                    <button type="button" onClick={() => toggleActive(p)} className="text-xs font-semibold">
                      {p.active === false ? "Activar" : "Desactivar"}
                    </button>
                    <Link href={`/recetas?product=${p.id}`} className="text-xs font-semibold text-[var(--color-saffron-glow)]">
                      Receta
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeProduct(p.id)}
                      className="text-xs font-semibold text-[var(--color-wine)]"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
              {!list.length ? (
                <p className="col-span-full border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5 text-[var(--color-espresso)]">
                  No hay productos con este filtro. Crea categorías y luego productos.
                </p>
              ) : null}
            </div>
          </div>

          <form onSubmit={onSave} className="h-fit border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
            <h2 className="text-xl font-normal">{editingId ? "Editar producto" : "Nuevo producto"}</h2>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
              Nombre *
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
              Categoría
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case"
              >
                <option value="">Sin categoría</option>
                {sortedCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
                Precio *
                <input
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
                Costo
                <input
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-espresso)]">
              Descripción
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="mt-1 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 py-2 font-normal normal-case"
              />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Activo en el menú
            </label>
            <label className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-[3px] bg-[var(--color-parchment)] px-4 text-xs font-semibold uppercase">
              {form.image_url ? "Cambiar foto" : "Subir foto"}
              <input type="file" accept="image/*" className="hidden" onChange={onImage} />
            </label>
            {form.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="mt-2 h-20 w-20 object-cover" />
            ) : null}
            {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="h-11 flex-1 rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)] disabled:opacity-60"
              >
                {editingId ? "Actualizar" : "Crear"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-11 rounded-[3px] border border-[var(--color-warm-stone)] px-4 text-xs font-semibold uppercase"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
            {editingId ? (
              <Link
                href={`/recetas?product=${editingId}`}
                className="mt-3 block text-center text-xs font-semibold uppercase text-[var(--color-saffron-glow)]"
              >
                Configurar receta / insumos →
              </Link>
            ) : null}
          </form>
        </div>
      )}
    </div>
  );
}
