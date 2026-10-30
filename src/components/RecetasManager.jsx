"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import {
  baseUnit,
  displayToBase,
  fromBase,
  hasLargeSmall,
  largeUnit,
  unitLabel,
} from "@/lib/units";

/**
 * Recetas — qty siempre se guarda en unidad BASE del insumo (g/ml/pza),
 * como WapifoodFront (kilos↔gramos, litros↔ml en UI).
 */
export function RecetasManager({ products, ingredients, categories = [], initialLines, focusProductId = null }) {
  const [lines, setLines] = useState(initialLines);
  const [productId, setProductId] = useState(focusProductId || products[0]?.id || "");
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id || "");
  const [qty, setQty] = useState("50");
  const [useLarge, setUseLarge] = useState(false); // true = capturar en kg o L
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const ingMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const selectedIng = ingMap.get(ingredientId);
  const base = selectedIng ? baseUnit(selectedIng.unit) : "pza";
  const canToggle = selectedIng ? hasLargeSmall(selectedIng.unit) : false;

  const catName = useMemo(() => {
    const m = new Map((categories || []).map((c) => [c.id, c.name]));
    return (id) => m.get(id) || "Sin categoría";
  }, [categories]);

  const byProduct = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (catFilter && p.category_id !== catFilter) return false;
        if (q && !String(p.name || "").toLowerCase().includes(q)) return false;
        return true;
      })
      .map((p) => ({
        ...p,
        lines: lines.filter((l) => l.product_id === p.id),
      }));
  }, [products, lines, search, catFilter]);

  function onPickIngredient(id) {
    setIngredientId(id);
    setUseLarge(false);
    const ing = ingMap.get(id);
    if (ing && hasLargeSmall(ing.unit)) {
      setQty("50"); // 50 g o 50 ml por defecto
    } else {
      setQty("1");
    }
  }

  function toggleLarge() {
    if (!canToggle) return;
    const current = parseFloat(qty) || 0;
    if (useLarge) {
      // kg/L → g/ml
      setQty(String(Number((current * 1000).toFixed(3))));
    } else {
      // g/ml → kg/L
      setQty(String(Number((current / 1000).toFixed(3))));
    }
    setUseLarge((v) => !v);
  }

  async function addLine(e) {
    e.preventDefault();
    setErr("");
    if (!productId || !ingredientId) {
      setErr("Elige producto e insumo");
      toast.error("Elige producto e insumo");
      return;
    }
    const { qty: baseQty } = displayToBase(qty, base, useLarge);
    if (!baseQty || baseQty <= 0) {
      setErr("Cantidad inválida");
      toast.error("Cantidad inválida");
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("recipe_lines")
      .upsert(
        { product_id: productId, ingredient_id: ingredientId, qty: baseQty },
        { onConflict: "product_id,ingredient_id" },
      )
      .select("*")
      .single();

    if (error) {
      setErr(error.message);
      toast.error(error.message);
      return;
    }
    toast.success(
      `Receta: ${baseQty} ${unitLabel(base)} por porción` +
        (useLarge ? ` (capturado en ${unitLabel(largeUnit(base))})` : ""),
    );
    setLines((ls) => {
      const rest = ls.filter(
        (l) => !(l.product_id === productId && l.ingredient_id === ingredientId),
      );
      return [...rest, data];
    });
    setQty(canToggle ? "50" : "1");
    setUseLarge(false);
  }

  async function removeLine(product_id, ingredient_id) {
    const supabase = createClient();
    const { error } = await supabase
      .from("recipe_lines")
      .delete()
      .eq("product_id", product_id)
      .eq("ingredient_id", ingredient_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLines((ls) =>
      ls.filter((l) => !(l.product_id === product_id && l.ingredient_id === ingredient_id)),
    );
    toast.success("Línea eliminada");
  }

  function formatLineQty(line) {
    const ing = ingMap.get(line.ingredient_id);
    const b = ing ? baseUnit(ing.unit) : "pza";
    const disp = fromBase(line.qty, b);
    const small = fromBase(line.qty, b, { forceSmall: true });
    if (disp.unit !== small.unit) {
      return `${small.qty} ${unitLabel(small.unit)} (${disp.qty} ${unitLabel(disp.unit)})`;
    }
    return `${small.qty} ${unitLabel(small.unit)}`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="h-11 min-w-[12rem] flex-1 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-3 text-sm"
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-11 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] px-2 text-sm"
          >
            <option value="">Todas las categorías</option>
            {(categories || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {!byProduct.length ? (
          <p className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4 text-sm text-[var(--color-walnut)]">
            Ningún producto coincide con el filtro.
          </p>
        ) : null}
        {byProduct.map((p) => (
          <article
            key={p.id}
            className={`border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4 ${
              focusProductId === p.id ? "ring-2 ring-[var(--color-saffron-glow)]" : ""
            }`}
          >
            <h3 className="text-xl font-normal">{p.name}</h3>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-walnut)]">{catName(p.category_id)}</p>
            {p.lines.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {p.lines.map((l) => (
                  <li key={`${l.product_id}-${l.ingredient_id}`} className="flex justify-between gap-2">
                    <span>
                      {ingMap.get(l.ingredient_id)?.name || "Insumo"} · {formatLineQty(l)}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--color-wine)]"
                      onClick={() => removeLine(l.product_id, l.ingredient_id)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-walnut)]">Sin receta (no descuenta stock al cobrar).</p>
            )}
          </article>
        ))}
      </div>

      <form onSubmit={addLine} className="h-fit border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
        <h2 className="text-xl font-normal">Agregar a receta</h2>
        <p className="mt-1 text-xs text-[var(--color-espresso)]">
          Las cantidades se guardan en unidad base del insumo (g / ml / pza), igual que en WapifoodFront.
        </p>

        <label className="mt-3 block text-xs font-semibold uppercase">
          Producto
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-2 block text-xs font-semibold uppercase">
          Insumo
          <select
            value={ingredientId}
            onChange={(e) => onPickIngredient(e.target.value)}
            className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case"
          >
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} (base: {unitLabel(baseUnit(i.unit))})
              </option>
            ))}
          </select>
        </label>

        <label className="mt-2 block text-xs font-semibold uppercase">
          Cantidad por porción
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min="0.001"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-11 min-w-0 flex-1 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
            />
            <span className="flex h-11 items-center border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 text-sm font-semibold">
              {useLarge ? unitLabel(largeUnit(base)) : unitLabel(base)}
            </span>
          </div>
        </label>

        {canToggle ? (
          <button
            type="button"
            onClick={toggleLarge}
            className="mt-2 text-xs font-semibold uppercase text-[var(--color-saffron-glow)]"
          >
            Cambiar a {useLarge ? unitLabel(base) : unitLabel(largeUnit(base))}
            {useLarge
              ? ` (${(parseFloat(qty) || 0) * 1000} ${unitLabel(base)})`
              : ` (${((parseFloat(qty) || 0) / 1000).toFixed(3)} ${unitLabel(largeUnit(base))})`}
          </button>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--color-walnut)]">Piezas: sin conversión kg/L.</p>
        )}

        {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}

        <button
          type="submit"
          className="mt-3 h-11 w-full rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]"
        >
          Guardar línea
        </button>
      </form>
    </div>
  );
}
