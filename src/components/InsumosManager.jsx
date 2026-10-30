"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { baseUnit, fromBase, toBase, unitLabel, UNIT_OPTIONS } from "@/lib/units";
import { AppModal } from "@/components/ui/AppModal";
import { StockMovesList } from "@/components/StockMovesList";
import {
  InventoryPinGate,
  InventoryPinSettings,
  useInventoryUnlock,
} from "@/components/InventoryPinGate";

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

export function InsumosManager({
  restaurantId,
  initialIngredients,
  initialMoves = [],
  inventoryPin = null,
}) {
  const hasPin = !!(inventoryPin && String(inventoryPin).length >= 4);
  const { unlocked, lock, unlockOk } = useInventoryUnlock(restaurantId, hasPin);

  const [tab, setTab] = useState("insumos");
  const [items, setItems] = useState(initialIngredients);
  const [moves, setMoves] = useState(initialMoves);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [loading, setLoading] = useState(false);

  // modal movimiento
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveType, setMoveType] = useState("entrada"); // entrada | merma
  const [moveIng, setMoveIng] = useState(null);
  const [moveQty, setMoveQty] = useState("1");
  const [moveNote, setMoveNote] = useState("");

  const names = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i.name])),
    [items],
  );

  const list = useMemo(() => {
    if (filter === "todos") return items;
    if (filter === "bajo") return items.filter((i) => Number(i.stock) <= Number(i.min_stock));
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
    if (!requireUnlock()) return;
    setEditingId(i.id);
    const stockDisp = fromBase(i.stock ?? 0, i.unit || "pza");
    const minDisp = fromBase(i.min_stock ?? 0, i.unit || "pza");
    setForm({
      name: i.name,
      unit: stockDisp.unit,
      stock: String(stockDisp.qty),
      min_stock: String(minDisp.qty),
      kind: i.kind || "no_perecedero",
      expires_on: i.expires_on || "",
      notes: i.notes || "",
    });
  }

  async function onSave(e) {
    e.preventDefault();
    if (!requireUnlock()) return;
    if (!form.name.trim()) return toast.error("Nombre obligatorio");
    const stockIn = Number(form.stock);
    const minIn = Number(form.min_stock);
    if (Number.isNaN(stockIn) || stockIn < 0) return toast.error("Stock inválido");
    if (Number.isNaN(minIn) || minIn < 0) return toast.error("Mínimo inválido");

    // Paridad Front: kilos→gramos, litros→ml al guardar
    const stockBase = toBase(stockIn, form.unit);
    const minBase = toBase(minIn, form.unit);

    setLoading(true);
    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      unit: stockBase.unit,
      stock: stockBase.qty,
      min_stock: minBase.qty,
      kind: form.kind || "no_perecedero",
      expires_on: form.kind === "perecedero" && form.expires_on ? form.expires_on : null,
      notes: form.notes?.trim() || null,
    };
    try {
      if (editingId) {
        const { data, error } = await supabase.from("ingredients").update(payload).eq("id", editingId).select("*").single();
        if (error) throw error;
        setItems((xs) => xs.map((x) => (x.id === editingId ? data : x)));
        toast.success("Insumo actualizado");
      } else {
        const { data, error } = await supabase.from("ingredients").insert(payload).select("*").single();
        if (error) throw error;
        setItems((xs) => [data, ...xs]);
        toast.success("Insumo creado");
      }
      setEditingId(null);
      setForm(empty);
    } catch (e2) {
      toast.error(e2.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!requireUnlock()) return;
    if (!(await confirmAsync("¿Eliminar este insumo?", { title: "Eliminar insumo" }))) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((xs) => xs.filter((x) => x.id !== id));
    toast.success("Insumo eliminado");
  }

  function requireUnlock() {
    if (hasPin && !unlocked) {
      toast.warning("Desbloquea el inventario con el PIN para editar.");
      return false;
    }
    return true;
  }

  function openMove(type, ing) {
    if (!requireUnlock()) return;

    setMoveType(type);
    setMoveIng(ing);
    setMoveQty(type === "entrada" ? (ing.unit === "g" || ing.unit === "ml" ? "200" : "10") : "1");
    setMoveNote(type === "entrada" ? "entrada" : "merma");
    setMoveOpen(true);
  }

  async function submitMove() {
    if (!moveIng) return;
    const qty = Number(moveQty);
    if (!qty || qty <= 0) return toast.error("Cantidad inválida");
    setLoading(true);
    const supabase = createClient();
    const rpc = moveType === "entrada" ? "register_entrada" : "register_merma";
    const { error } = await supabase.rpc(rpc, {
      p_ingredient: moveIng.id,
      p_qty: qty,
      p_note: moveNote || moveType,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message + (error.message?.includes("register_entrada") ? " — ¿SQL 020?" : ""));
      return;
    }
    const delta = moveType === "entrada" ? qty : -qty;
    setItems((xs) =>
      xs.map((x) =>
        x.id === moveIng.id
          ? { ...x, stock: Math.max(0, Number(x.stock) + delta) }
          : x,
      ),
    );
    setMoves((ms) => [
      {
        id: crypto.randomUUID(),
        ingredient_id: moveIng.id,
        qty: delta,
        reason: moveNote || moveType,
        created_at: new Date().toISOString(),
      },
      ...ms,
    ]);
    setMoveOpen(false);
    toast.success(moveType === "entrada" ? "Entrada registrada" : "Merma registrada");
  }

  const filters = [
    { id: "todos", label: "Todos" },
    { id: "perecedero", label: "Perecederos" },
    { id: "no_perecedero", label: "No perecederos" },
    { id: "bajo", label: "Stock bajo" },
    { id: "por_caducar", label: "Por caducar" },
  ];

  const tabs = [
    { id: "insumos", label: `Insumos (${items.length})` },
    { id: "kardex", label: "Kardex" },
    { id: "seguridad", label: "PIN / Seguridad" },
  ];

  return (
    <div>
      <LoadingOverlay visible={loading} message="Procesando inventario…" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-10 rounded-[3px] px-4 text-xs font-semibold uppercase ${
                tab === t.id
                  ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                  : "bg-[var(--color-paper)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {hasPin && unlocked && tab !== "seguridad" ? (
          <button type="button" onClick={lock} className="text-xs font-semibold uppercase text-[var(--color-wine)]">
            Bloquear inventario
          </button>
        ) : null}
      </div>

      {tab === "seguridad" ? (
        <InventoryPinSettings restaurantId={restaurantId} initialPin={inventoryPin || ""} />
      ) : (
        <InventoryPinGate
          restaurantId={restaurantId}
          hasPin={hasPin}
          inventoryPin={inventoryPin}
          unlocked={unlocked}
          unlockOk={unlockOk}
        >
          {tab === "kardex" ? (
            <div>
              <h2 className="mb-3 text-xl font-normal">Kardex / movimientos</h2>
              <StockMovesList moves={moves} ingredientNames={names} />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div>
                <div className="mb-3 flex flex-wrap gap-1">
                  {filters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`h-9 rounded-[3px] px-3 text-[11px] font-semibold uppercase ${
                        filter === f.id
                          ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                          : "bg-[var(--color-paper)]"
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
                      <article key={ing.id} className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
                        <div className="flex justify-between gap-2">
                          <div>
                            <h3 className="text-xl font-normal">{ing.name}</h3>
                            <p className="text-[11px] font-semibold uppercase text-[var(--color-saffron-glow)]">
                              {ing.kind === "perecedero" ? "Perecedero" : "No perecedero"}
                            </p>
                            <p className="text-sm text-[var(--color-espresso)]">
                              mín. {fromBase(ing.min_stock, ing.unit).qty} {unitLabel(fromBase(ing.min_stock, ing.unit).unit)}
                            </p>
                            {ing.expires_on ? (
                              <p className={`text-xs ${expired ? "text-[var(--color-wine)]" : expiring ? "text-[var(--color-saffron-glow)]" : "text-[var(--color-walnut)]"}`}>
                                Caduca: {ing.expires_on}
                                {d != null ? (expired ? " (vencido)" : ` (${d}d)`) : ""}
                              </p>
                            ) : null}
                          </div>
                          <p className={`text-2xl font-semibold ${low ? "text-[var(--color-wine)]" : ""}`}>
                            {fromBase(ing.stock, ing.unit).qty}
                            <span className="ml-1 text-sm font-normal">{unitLabel(fromBase(ing.stock, ing.unit).unit)}</span>
                            {fromBase(ing.stock, ing.unit).unit !== baseUnit(ing.unit) ? (
                              <span className="mt-0.5 block text-[10px] font-normal text-[var(--color-walnut)]">
                                ({fromBase(ing.stock, ing.unit, { forceSmall: true }).qty} {unitLabel(baseUnit(ing.unit))})
                              </span>
                            ) : null}
                          </p>
                        </div>
                        {low ? <p className="mt-2 text-xs font-semibold text-[var(--color-wine)]">Stock bajo</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" className="text-xs font-semibold" onClick={() => startEdit(ing)}>Editar</button>
                          <button type="button" className="text-xs font-semibold" onClick={() => openMove("entrada", ing)}>Entrada</button>
                          <button type="button" className="text-xs font-semibold" onClick={() => openMove("merma", ing)}>Merma</button>
                          <button type="button" className="text-xs font-semibold text-[var(--color-wine)]" onClick={() => remove(ing.id)}>Eliminar</button>
                        </div>
                      </article>
                    );
                  })}
                  {!items.length ? (
                    <p className="col-span-full border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5">
                      Aún no hay insumos. Crea el primero con el formulario de la derecha.
                    </p>
                  ) : !list.length ? (
                    <p className="col-span-full border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5">
                      No hay insumos en este filtro ({items.length} en total).
                    </p>
                  ) : null}
                </div>
              </div>

              <form onSubmit={onSave} className="h-fit border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
                <h2 className="text-xl font-normal">{editingId ? "Editar insumo" : "Nuevo insumo"}</h2>
                <label className="mt-3 block text-xs font-semibold uppercase">Nombre
                  <input className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </label>
                <label className="mt-2 block text-xs font-semibold uppercase">Tipo
                  <select className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                    {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold uppercase">Unidad
                    <select className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                      {UNIT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold uppercase">Stock
                    <input className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-semibold uppercase">Mínimo
                    <input className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case" value={form.min_stock} onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))} />
                  </label>
                  {form.kind === "perecedero" ? (
                    <label className="block text-xs font-semibold uppercase">Caducidad
                      <input type="date" className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 font-normal normal-case" value={form.expires_on} onChange={(e) => setForm((f) => ({ ...f, expires_on: e.target.value }))} />
                    </label>
                  ) : null}
                </div>
                <label className="mt-2 block text-xs font-semibold uppercase">Notas
                  <input className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </label>
                <div className="mt-3 flex gap-2">
                  <button type="submit" className="h-11 flex-1 rounded-[3px] bg-[var(--color-onyx-warm)] text-xs font-semibold uppercase text-[var(--color-parchment)]">
                    {editingId ? "Guardar" : "Crear"}
                  </button>
                  {editingId ? (
                    <button type="button" className="h-11 border border-[var(--color-warm-stone)] px-3 text-xs font-semibold uppercase" onClick={() => { setEditingId(null); setForm(empty); }}>
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          )}
        </InventoryPinGate>
      )}

      {/* Modal entrada / merma */}
      {moveOpen ? (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-6 shadow-2xl">
            <h2 className="text-2xl font-normal">
              {moveType === "entrada" ? "Entrada de stock" : "Registrar merma"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-espresso)]">
              {moveIng?.name} · stock actual {moveIng?.stock} {moveIng?.unit}
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase">
              Cantidad
              <input
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold uppercase">
              Nota
              <input
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                className="mt-1 h-11 w-full border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-3 font-normal normal-case"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setMoveOpen(false)} className="h-11 border border-[var(--color-warm-stone)] px-4 text-xs font-semibold uppercase">
                Cancelar
              </button>
              <button type="button" onClick={submitMove} className="h-11 bg-[var(--color-onyx-warm)] px-4 text-xs font-semibold uppercase text-[var(--color-parchment)]">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
