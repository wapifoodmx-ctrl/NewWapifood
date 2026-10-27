"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RecetasManager({ products, ingredients, initialLines }) {
  const [lines, setLines] = useState(initialLines);
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id || "");
  const [qty, setQty] = useState("1");
  const [err, setErr] = useState("");

  const ingMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const byProduct = products.map((p) => ({
    ...p,
    lines: lines.filter((l) => l.product_id === p.id),
  }));

  async function addLine(e) {
    e.preventDefault();
    setErr("");
    const q = Number(qty);
    if (!productId || !ingredientId) return setErr("Elige producto e insumo");
    if (!q || q <= 0) return setErr("Cantidad inválida");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("recipe_lines")
      .upsert({ product_id: productId, ingredient_id: ingredientId, qty: q }, { onConflict: "product_id,ingredient_id" })
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setLines((ls) => {
      const rest = ls.filter((l) => !(l.product_id === productId && l.ingredient_id === ingredientId));
      return [...rest, data];
    });
    setQty("1");
  }

  async function removeLine(product_id, ingredient_id) {
    const supabase = createClient();
    const { error } = await supabase
      .from("recipe_lines")
      .delete()
      .eq("product_id", product_id)
      .eq("ingredient_id", ingredient_id);
    if (error) return setErr(error.message);
    setLines((ls) => ls.filter((l) => !(l.product_id === product_id && l.ingredient_id === ingredient_id)));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {byProduct.map((p) => (
          <article key={p.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
            <h3 className="text-xl">{p.name}</h3>
            {p.lines.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--color-muted)]">Sin receta — al cobrar no descontará insumos</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {p.lines.map((l) => {
                  const ing = ingMap.get(l.ingredient_id);
                  return (
                    <li key={`${l.product_id}-${l.ingredient_id}`} className="flex justify-between gap-2">
                      <span>
                        {l.qty} {ing?.unit} · {ing?.name || "Insumo"}
                      </span>
                      <button type="button" onClick={() => removeLine(l.product_id, l.ingredient_id)} className="text-[var(--color-wine)]">
                        Quitar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
      </div>

      <form onSubmit={addLine} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <h3 className="text-lg font-semibold">Línea de receta</h3>
        <label className="mt-3 block text-sm font-semibold">
          Producto
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal">
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-sm font-semibold">
          Insumo
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal">
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-sm font-semibold">
          Cantidad
          <input type="number" min="0.01" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 font-normal" />
        </label>
        {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
        <button type="submit" className="mt-3 h-11 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]">
          Guardar línea
        </button>
      </form>
    </div>
  );
}
