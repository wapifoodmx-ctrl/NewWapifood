"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";

const KIND = {
  venta_efectivo: "Venta en efectivo",
  propina_efectivo: "Propina en efectivo",
  entrada: "Entrada",
  salida: "Salida",
};

export function TurnoCaja({ restaurantId, initialSession, initialMoves, history }) {
  const [session, setSession] = useState(initialSession);
  const [moves, setMoves] = useState(initialMoves || []);
  const [floatAmt, setFloatAmt] = useState("");
  const [moveKind, setMoveKind] = useState("salida");
  const [moveAmt, setMoveAmt] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  const expected = session
    ? Number(session.opening_float || 0) +
      moves.reduce((s, m) => s + (m.kind === "salida" ? -Number(m.amount) : Number(m.amount)), 0)
    : 0;

  function schemaMissing(error) {
    const text = String(error?.message || error || "");
    return /cash_sessions|open_cash_session|schema cache|PGRST202|does not exist/i.test(text);
  }

  async function openShift(e) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("open_cash_session", {
      p_restaurant: restaurantId,
      p_float: Number(floatAmt || 0),
    });
    setBusy(false);
    if (error) {
      if (schemaMissing(error)) setMissing(true);
      toast.error(error.message);
      return;
    }
    setSession({
      id: data,
      opening_float: Number(floatAmt || 0),
      opened_at: new Date().toISOString(),
      status: "open",
    });
    setMoves([]);
    setFloatAmt("");
    toast.success("Turno abierto");
  }

  async function addMove(e) {
    e.preventDefault();
    if (!session) return;
    const amount = Number(moveAmt);
    if (!amount || amount <= 0) {
      toast.warning("Escribe una cantidad mayor a cero");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_cash_movement", {
      p_session: session.id,
      p_kind: moveKind,
      p_amount: amount,
      p_note: moveNote || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setMoves((list) => [
      { id: crypto.randomUUID(), kind: moveKind, amount, note: moveNote, created_at: new Date().toISOString() },
      ...list,
    ]);
    setMoveAmt("");
    setMoveNote("");
    toast.success(moveKind === "salida" ? "Salida registrada" : "Entrada registrada");
  }

  async function closeShift(e) {
    e.preventDefault();
    if (!session) return;
    const value = Number(counted);
    if (Number.isNaN(value) || value < 0) {
      toast.warning("Escribe cuánto hay en el cajón");
      return;
    }
    const ok = await confirmAsync("Al cerrar el turno se guarda el conteo y la diferencia. Las ventas de después no entran a este corte.", {
      title: "Cerrar turno",
      confirmLabel: "Cerrar turno",
      cancelLabel: "Seguir abierto",
    });
    if (!ok) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("close_cash_session", {
      p_session: session.id,
      p_counted: value,
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Turno cerrado. Diferencia ${money(data)}`);
    setSession(null);
    setMoves([]);
    setCounted("");
    setNotes("");
  }

  if (missing) {
    return (
      <div className="card p-5">
        <h2 className="text-2xl">Falta aplicar la migración del turno</h2>
        <p className="mt-2 text-base text-[var(--ink-soft)]">
          El corte usa las tablas de turno. Cuando el deploy aplique <code>20261104010000</code>, esta pantalla abre el cajón.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="card p-5">
        <h2 className="text-2xl">{session ? "Turno abierto" : "No hay turno abierto"}</h2>
        <p className="mt-1 text-base text-[var(--ink-soft)]">
          El efectivo esperado es el fondo, más ventas y propinas en efectivo, más entradas, menos salidas. Tarjeta y transferencia no entran al cajón. Se puede cobrar aunque el turno no esté abierto.
        </p>
        {session ? (
          <>
            <p className="mt-4 text-lg">Fondo {money(session.opening_float)}</p>
            <p className="text-3xl font-extrabold">Esperado {money(expected)}</p>
            <p className="text-sm text-[var(--ink-soft)]">
              Abierto {session.opened_at ? new Date(session.opened_at).toLocaleString("es-MX") : ""}
            </p>
            <form onSubmit={addMove} className="mt-4 grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]">
              <label className="text-sm font-bold">
                Tipo
                <select className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2" value={moveKind} onChange={(e) => setMoveKind(e.target.value)}>
                  <option value="salida">Salida</option>
                  <option value="entrada">Entrada</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Cantidad
                <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" inputMode="decimal" value={moveAmt} onChange={(e) => setMoveAmt(e.target.value.replace(/[^\d.]/g, ""))} />
              </label>
              <label className="text-sm font-bold">
                Nota
                <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={moveNote} onChange={(e) => setMoveNote(e.target.value)} placeholder="Proveedor, cambio, etc." />
              </label>
              <button type="submit" className="btn-primary mt-5" disabled={busy}>Anotar</button>
            </form>
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {moves.length === 0 ? <li className="py-3 text-[var(--ink-soft)]">Todavía no hay movimientos en este turno.</li> : null}
              {moves.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">{KIND[m.kind] || m.kind}</p>
                    <p className="text-sm text-[var(--ink-soft)]">{m.note || ""}</p>
                  </div>
                  <p className="text-lg font-extrabold">{m.kind === "salida" ? "−" : "+"}{money(m.amount)}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form onSubmit={openShift} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm font-bold">
              Fondo inicial
              <input className="mt-1 h-12 w-40 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xl font-extrabold" inputMode="decimal" value={floatAmt} onChange={(e) => setFloatAmt(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
            </label>
            <button type="submit" className="btn-lg btn-primary" disabled={busy}>Abrir turno</button>
          </form>
        )}
      </section>

      <section className="grid gap-4">
        {session ? (
          <form onSubmit={closeShift} className="card p-5">
            <h2 className="text-2xl">Cerrar y contar</h2>
            <label className="mt-3 block text-sm font-bold">
              Efectivo contado
              <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 text-2xl font-extrabold" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))} />
            </label>
            {counted !== "" ? (
              <p className="mt-2 text-lg font-bold">
                Diferencia {money(Number(counted) - expected)}
              </p>
            ) : null}
            <label className="mt-3 block text-sm font-bold">
              Nota del corte
              <textarea className="mt-1 min-h-20 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <button type="submit" className="btn-danger mt-3 w-full" disabled={busy}>Cerrar turno</button>
          </form>
        ) : null}
        <div className="card p-5">
          <h2 className="text-2xl">Cortes anteriores</h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {(history || []).length === 0 ? <li className="py-2 text-[var(--ink-soft)]">Aún no hay un corte guardado.</li> : null}
            {(history || []).map((h) => (
              <li key={h.id} className="py-3">
                <p className="font-bold">{h.closed_at ? new Date(h.closed_at).toLocaleString("es-MX") : "Abierto"}</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  Esperado {money(h.expected_cash)} · Contado {money(h.counted_cash)} · Diferencia {money(h.difference)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
