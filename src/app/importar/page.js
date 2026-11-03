"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";
import { baseUnit, normalizeUnit } from "@/lib/units";
import { toast } from "@/components/ui/Toast";

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] || ""]));
  });
}

function toBaseQty(qty, unit) {
  const n = Number(String(qty).replace(",", ".")) || 0;
  const u = normalizeUnit(unit);
  if (u === "kg" || u === "l") return { qty: n * 1000, unit: baseUnit(u) };
  return { qty: n, unit: baseUnit(u) };
}

export default function ImportarPage() {
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  async function restaurantId() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Inicia sesión");
    const { data, error } = await supabase
      .from("memberships")
      .select("restaurant_id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();
    if (error || !data?.restaurant_id) throw new Error("Sin restaurante");
    return { supabase, rid: data.restaurant_id };
  }

  async function onIngredients(file) {
    setBusy(true);
    try {
      const { supabase, rid } = await restaurantId();
      const rows = parseCsv(await file.text());
      let ok = 0;
      for (const row of rows) {
        const name = row.nombre || row.name;
        if (!name) continue;
        const converted = toBaseQty(row.stock || row.existencia || 0, row.unidad || row.unit || "pza");
        const min = toBaseQty(row.minimo || row.min_stock || 0, row.unidad || row.unit || "pza");
        const { error } = await supabase.from("ingredients").insert({
          restaurant_id: rid,
          name,
          unit: converted.unit,
          stock: converted.qty,
          min_stock: min.qty,
          kind: row.tipo === "perecedero" ? "perecedero" : "no_perecedero",
          is_extra: /^(1|si|sí|true)$/i.test(row.adicional || ""),
        });
        if (error) throw error;
        ok += 1;
      }
      setLog(`Insumos importados: ${ok}`);
      toast.success(`Insumos importados: ${ok}`);
    } catch (e) {
      setLog(e.message);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onProducts(file) {
    setBusy(true);
    try {
      const { supabase, rid } = await restaurantId();
      const rows = parseCsv(await file.text());
      const { data: cats } = await supabase.from("categories").select("id,name").eq("restaurant_id", rid);
      const byName = new Map((cats || []).map((c) => [c.name.toLowerCase(), c.id]));
      let ok = 0;
      for (const row of rows) {
        const name = row.nombre || row.name;
        if (!name) continue;
        const catName = row.categoria || row.category || "General";
        let categoryId = byName.get(catName.toLowerCase());
        if (!categoryId) {
          const { data, error } = await supabase
            .from("categories")
            .insert({ restaurant_id: rid, name: catName })
            .select("id")
            .single();
          if (error) throw error;
          categoryId = data.id;
          byName.set(catName.toLowerCase(), categoryId);
        }
        const { error } = await supabase.from("products").insert({
          restaurant_id: rid,
          category_id: categoryId,
          name,
          price: Number(String(row.precio || row.price || 0).replace(",", ".")) || 0,
          description: row.descripcion || row.description || null,
          inventory_mode: row.inventario || "unitario",
          active: true,
        });
        if (error) throw error;
        ok += 1;
      }
      setLog(`Productos importados: ${ok}`);
      toast.success(`Productos importados: ${ok}`);
    } catch (e) {
      setLog(e.message);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Importar">
      <p className="mb-4 text-sm text-[var(--color-espresso)]">
        CSV del legado (insumos y productos). La primera fila son los títulos. Kg y litros se guardan en g y ml.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          Insumos
          <span className="mt-1 block text-xs text-[var(--color-walnut)]">nombre, unidad, stock, minimo, tipo, adicional</span>
          <input className="mt-3 block" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => e.target.files?.[0] && onIngredients(e.target.files[0])} />
        </label>
        <label className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          Productos
          <span className="mt-1 block text-xs text-[var(--color-walnut)]">nombre, precio, categoria, descripcion, inventario</span>
          <input className="mt-3 block" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => e.target.files?.[0] && onProducts(e.target.files[0])} />
        </label>
      </div>
      {log ? <p className="mt-4 text-sm" role="status">{log}</p> : null}
    </AppShell>
  );
}
