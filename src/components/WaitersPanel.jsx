"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

export function WaitersPanel({ restaurantId, initialWaiters, tables, initialAssignments }) {
  const [waiters, setWaiters] = useState(initialWaiters);
  const [assignments, setAssignments] = useState(initialAssignments || []);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  async function addWaiter(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{4,8}$/.test(code)) {
      setError("El código debe ser de 4 a 8 dígitos.");
      return;
    }
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("waiters")
      .insert({ restaurant_id: restaurantId, name: name.trim(), access_code: code, active: true })
      .select("*")
      .single();
    if (err) {
      setError(err.message + " — ¿ya corriste supabase/004_schema_saas_completo.sql?");
      return;
    }
    setWaiters((w) => [...w, data]);
    setName("");
    setCode("");
  }

  async function toggleActive(w) {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("waiters")
      .update({ active: !w.active })
      .eq("id", w.id)
      .select("*")
      .single();
    if (err) return setError(err.message);
    setWaiters((ws) => ws.map((x) => (x.id === w.id ? data : x)));
  }

  async function removeWaiter(id) {
    if (!confirm("¿Eliminar mesero?")) return;
    const supabase = createClient();
    await supabase.from("waiters").delete().eq("id", id);
    setWaiters((w) => w.filter((x) => x.id !== id));
    setAssignments((a) => a.filter((x) => x.waiter_id !== id));
    if (selected === id) setSelected(null);
  }

  async function toggleTable(waiterId, tableId) {
    const supabase = createClient();
    const exists = assignments.find((a) => a.waiter_id === waiterId && a.table_id === tableId);
    if (exists) {
      await supabase.from("waiter_tables").delete().eq("waiter_id", waiterId).eq("table_id", tableId);
      setAssignments((a) => a.filter((x) => !(x.waiter_id === waiterId && x.table_id === tableId)));
    } else {
      const { error: err } = await supabase.from("waiter_tables").insert({ waiter_id: waiterId, table_id: tableId });
      if (err) return setError(err.message);
      setAssignments((a) => [...a, { waiter_id: waiterId, table_id: tableId }]);
    }
  }

  const assignedFor = (wid) => assignments.filter((a) => a.waiter_id === wid).map((a) => a.table_id);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <form onSubmit={addWaiter} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <h2 className="text-2xl">Nuevo mesero</h2>
          <label className="mt-3 block text-sm font-semibold">
            Nombre
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Código de acceso (4–8 dígitos)
            <input required minLength={4} maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3" />
          </label>
          {error ? <p className="mt-2 text-sm text-[var(--color-wine)]">{error}</p> : null}
          <button type="submit" className="mt-4 h-11 rounded-full bg-[var(--color-ink)] px-5 font-semibold text-[var(--color-cream)]">
            Guardar
          </button>
        </form>

        <div className="space-y-2">
          {waiters.map((w) => (
            <div key={w.id} className={`rounded-2xl border px-4 py-3 ${selected === w.id ? "border-[var(--color-ember)] bg-[var(--color-cream)]" : "border-[var(--color-line)] bg-[var(--color-paper)]"}`}>
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setSelected(w.id)} className="text-left">
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    código {w.access_code} · {w.active === false ? "inactivo" : "activo"} · {assignedFor(w.id).length} mesas
                  </p>
                </button>
                <div className="flex flex-col gap-1 text-right text-sm font-semibold">
                  <button type="button" onClick={() => toggleActive(w)}>{w.active === false ? "Activar" : "Pausar"}</button>
                  <button type="button" onClick={() => removeWaiter(w.id)} className="text-[var(--color-wine)]">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
          {waiters.length === 0 ? <p className="text-[var(--color-muted)]">Aún no hay meseros.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <h2 className="text-2xl">Asignar mesas</h2>
        {!selected ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">Selecciona un mesero para asignarle mesas.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tables.map((t) => {
              const on = assignedFor(selected).includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTable(selected, t.id)}
                  className={`rounded-xl border p-3 text-left ${on ? "border-[var(--color-ember)] bg-[var(--color-ember)] text-white" : "border-[var(--color-line)] bg-[var(--color-cream)]"}`}
                >
                  <p className="font-semibold">Mesa {t.number}</p>
                  <p className="text-xs opacity-80">{t.seats} lugares</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
