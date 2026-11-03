"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMissingRelation } from "@/lib/schema";
import { toast } from "@/components/ui/Toast";

export function ListsManager({ restaurantId, products, initialLists, unavailable }) {
  const [lists, setLists] = useState(initialLists || []);
  const [name, setName] = useState("");
  const [active, setActive] = useState(initialLists?.[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [blocked, setBlocked] = useState(unavailable);

  if (blocked) {
    return (
      <p className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4 text-sm" role="status">
        Las listas custom llegan con la migración de Supabase. El resto del panel sigue funcionando.
      </p>
    );
  }

  const current = lists.find((l) => l.id === active);

  async function createList(e) {
    e.preventDefault();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("product_lists")
      .insert({ restaurant_id: restaurantId, name: name.trim() })
      .select("id,name,product_list_items(product_id,sort_order)")
      .single();
    if (error) {
      if (isMissingRelation(error)) {
        setBlocked(true);
        return;
      }
      toast.error(error.message);
      return;
    }
    setLists((ls) => [...ls, { ...data, product_list_items: data.product_list_items || [] }]);
    setActive(data.id);
    setName("");
  }

  async function addProduct(e) {
    e.preventDefault();
    if (!current || !productId) return;
    const supabase = createClient();
    const { error } = await supabase.from("product_list_items").upsert(
      { list_id: current.id, product_id: productId, sort_order: (current.product_list_items || []).length },
      { onConflict: "list_id,product_id" },
    );
    if (error) {
      if (isMissingRelation(error)) {
        setBlocked(true);
        return;
      }
      toast.error(error.message);
      return;
    }
    setLists((ls) =>
      ls.map((l) =>
        l.id === current.id
          ? {
              ...l,
              product_list_items: [
                ...(l.product_list_items || []).filter((i) => i.product_id !== productId),
                { product_id: productId, sort_order: (l.product_list_items || []).length },
              ],
            }
          : l,
      ),
    );
  }

  async function removeItem(listId, pid) {
    const supabase = createClient();
    const { error } = await supabase.from("product_list_items").delete().eq("list_id", listId).eq("product_id", pid);
    if (error) {
      if (!isMissingRelation(error)) toast.error(error.message);
      return;
    }
    setLists((ls) =>
      ls.map((l) =>
        l.id === listId
          ? { ...l, product_list_items: (l.product_list_items || []).filter((i) => i.product_id !== pid) }
          : l,
      ),
    );
  }

  async function removeList(id) {
    const supabase = createClient();
    const { error } = await supabase.from("product_lists").delete().eq("id", id);
    if (error && !isMissingRelation(error)) toast.error(error.message);
    setLists((ls) => ls.filter((l) => l.id !== id));
    if (active === id) setActive("");
  }

  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Producto";

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div>
        <form onSubmit={createList} className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-3">
          <label className="text-xs font-semibold uppercase">
            Nueva lista
            <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case" />
          </label>
          <button type="submit" className="mt-2 h-10 w-full bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]">
            Crear
          </button>
        </form>
        <ul className="mt-3 space-y-1">
          {lists.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => setActive(l.id)} className={`h-10 w-full px-2 text-left text-sm ${active === l.id ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-paper)]"}`}>
                {l.name}
              </button>
            </li>
          ))}
          {!lists.length ? <li className="text-sm text-[var(--color-walnut)]">Sin listas.</li> : null}
        </ul>
      </div>
      {current ? (
        <section className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-normal">{current.name}</h2>
            <button type="button" className="text-xs font-semibold uppercase text-[var(--color-wine)]" onClick={() => removeList(current.id)}>
              Eliminar lista
            </button>
          </div>
          <p className="mt-1 text-sm text-[var(--color-espresso)]">
            Estas listas alimentan pantallas del local, como la lista personalizada del front.
          </p>
          <form onSubmit={addProduct} className="mt-3 flex gap-2">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-11 min-w-0 flex-1 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2">
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="submit" className="h-11 px-3 text-xs font-semibold uppercase">Agregar</button>
          </form>
          <ul className="mt-3 space-y-2">
            {(current.product_list_items || []).map((item) => (
              <li key={item.product_id} className="flex justify-between border-b border-[var(--color-warm-stone)] py-2 text-sm">
                <span>{nameOf(item.product_id)}</span>
                <button type="button" className="text-xs font-semibold uppercase text-[var(--color-wine)]" onClick={() => removeItem(current.id, item.product_id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-[var(--color-walnut)]">Elige o crea una lista.</p>
      )}
    </div>
  );
}
