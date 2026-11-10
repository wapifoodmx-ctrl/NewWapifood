"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { Icon } from "@/components/ui/Icon";

const KIND = {
  venta_efectivo: "Venta en efectivo",
  propina_efectivo: "Propina en efectivo",
  entrada: "Entrada",
  salida: "Salida",
};

const BILLS = [1000, 500, 200, 100, 50, 20];
const COINS = [20, 10, 5, 2, 1, 0.5];

function moneyKey(prefix, value) {
  return `${prefix}-${value}`;
}

function sumDrawer(counts) {
  return Object.entries(counts).reduce((sum, [key, qty]) => {
    const value = Number(key.split("-")[1]);
    return sum + value * Number(qty || 0);
  }, 0);
}

function printCut(title, report, counted, notes) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return false;
  const methods = (report?.by_method || []).map((row) => {
    const typed = counted?.[row.method];
    const diff = typed === "" || typed == null ? "sin contar" : (Number(typed) - Number(row.food || 0)).toFixed(2);
    return `<tr><td>${row.method}</td><td>${row.tickets}</td><td>${row.food}</td><td>${row.tips}</td><td>${typed ?? ""}</td><td>${diff}</td></tr>`;
  }).join("");
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#2a2118} table{border-collapse:collapse;width:100%} td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left} h1{font-size:22px}</style>
    </head><body><h1>${title}</h1>
    <p>Del ${report?.opened_at || ""} al ${report?.until || ""}</p>
    <p>Fondo ${report?.opening_float ?? 0}. Efectivo esperado en el cajón ${report?.expected_cash ?? 0}. Contado ${counted?.efectivo ?? ""}.</p>
    <p>Cuentas ${report?.tickets ?? 0}. Alimentos ${report?.food ?? 0}. Propinas ${report?.tips ?? 0}. Descuentos ${report?.discounts ?? 0}. Devoluciones ${report?.refunds ?? 0}. Cancelaciones ${report?.cancellations ?? 0}.</p>
    <table><thead><tr><th>Método</th><th>Cuentas</th><th>Alimentos</th><th>Propinas</th><th>Contado</th><th>Diferencia de alimentos</th></tr></thead><tbody>${methods}</tbody></table>
    <p>${notes || ""}</p></body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

export function TurnoCaja({ restaurantId, initialSession, initialMoves, history, cuts = [] }) {
  const [session, setSession] = useState(initialSession);
  const [moves, setMoves] = useState(initialMoves || []);
  const [floatAmt, setFloatAmt] = useState("");
  const [moveKind, setMoveKind] = useState("salida");
  const [moveAmt, setMoveAmt] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [drawer, setDrawer] = useState({});
  const [cardCounted, setCardCounted] = useState("");
  const [transferCounted, setTransferCounted] = useState("");
  const [report, setReport] = useState(null);
  const [savedCuts, setSavedCuts] = useState(cuts);
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

  function countedPayload(cash) {
    const payload = { efectivo: Number(cash.toFixed(2)) };
    if (cardCounted !== "") payload.tarjeta = Number(cardCounted);
    if (transferCounted !== "") payload.transferencia = Number(transferCounted);
    return payload;
  }

  async function loadReport() {
    if (!session) return null;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("cash_session_report", { p_session: session.id });
    if (error) {
      toast.error(error.message);
      return null;
    }
    setReport(data);
    return data;
  }

  async function savePartial() {
    if (!session) return;
    const cash = counted === "" ? sumDrawer(drawer) : Number(counted);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("save_partial_cut", {
      p_session: session.id,
      p_counted: countedPayload(cash),
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const snap = await loadReport();
    setSavedCuts((list) => [{ id: data, kind: "parcial", created_at: new Date().toISOString(), snapshot: snap }, ...list]);
    toast.success("Corte parcial guardado. La caja sigue abierta.");
  }

  async function closeShift(e) {
    e.preventDefault();
    if (!session) return;
    const value = counted === "" ? sumDrawer(drawer) : Number(counted);
    if (Number.isNaN(value) || value < 0) {
      toast.warning("Cuenta el efectivo del cajón");
      return;
    }
    const ok = await confirmAsync("El corte del día cierra la caja. Puedes seguir cobrando después; esas ventas no entran a este corte.", {
      title: "Corte del día",
      confirmLabel: "Cerrar caja",
      cancelLabel: "Seguir abierta",
    });
    if (!ok) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("close_cash_day", {
      p_session: session.id,
      p_counted_cash: value,
      p_counted: countedPayload(value),
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Caja cerrada. Diferencia de efectivo ${money(data)}`);
    setSession(null);
    setMoves([]);
    setCounted("");
    setNotes("");
    setReport(null);
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
            <button type="submit" className="btn-lg btn-primary inline-flex items-center gap-2" disabled={busy}>
              <Icon name="register" size={22} /> Abrir caja
            </button>
          </form>
        )}
      </section>

      <section className="grid gap-4">
        {session ? (
          <form onSubmit={closeShift} className="card p-5">
            <h2 className="text-2xl">Contar y cortar</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">El corte parcial no cierra la caja. El corte del día sí.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {BILLS.map((value) => (
                <label key={moneyKey("billete", value)} className="text-sm font-bold">
                  Billete de ${value}
                  <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" inputMode="numeric" value={drawer[moneyKey("billete", value)] || ""} onChange={(e) => setDrawer((prev) => ({ ...prev, [moneyKey("billete", value)]: e.target.value.replace(/\D/g, "") }))} />
                </label>
              ))}
              {COINS.map((value) => (
                <label key={moneyKey("moneda", value)} className="text-sm font-bold">
                  Moneda de ${value}
                  <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" inputMode="numeric" value={drawer[moneyKey("moneda", value)] || ""} onChange={(e) => setDrawer((prev) => ({ ...prev, [moneyKey("moneda", value)]: e.target.value.replace(/\D/g, "") }))} />
                </label>
              ))}
            </div>
            <p className="mt-3 text-lg font-bold">Efectivo contado {money(counted === "" ? sumDrawer(drawer) : Number(counted))}</p>
            <p className="text-base">Diferencia del cajón {money((counted === "" ? sumDrawer(drawer) : Number(counted)) - expected)}</p>
            <label className="mt-3 block text-sm font-bold">
              Si el conteo no coincide con los billetes, escríbelo
              <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Opcional" />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Tarjeta contada en la terminal
              <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" inputMode="decimal" value={cardCounted} onChange={(e) => setCardCounted(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Opcional" />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Transferencia contada
              <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" inputMode="decimal" value={transferCounted} onChange={(e) => setTransferCounted(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Opcional" />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Nota del corte
              <textarea className="mt-1 min-h-20 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="mt-3 grid gap-2">
              <button type="button" className="btn-ghost h-12" disabled={busy} onClick={loadReport}>
                <Icon name="receipt" size={20} /> Ver corte
              </button>
              <button type="button" className="btn-ghost h-12" disabled={busy} onClick={savePartial}>
                Guardar corte parcial
              </button>
              <button type="button" className="btn-ghost h-12" disabled={busy} onClick={async () => {
                const snap = report || await loadReport();
                if (!snap) return;
                const cash = counted === "" ? sumDrawer(drawer) : Number(counted);
                if (!printCut("Corte parcial", snap, countedPayload(cash), notes)) toast.error("El navegador bloqueó la ventana de impresión");
              }}>
                Imprimir o guardar PDF
              </button>
              <button type="submit" className="btn-danger h-14" disabled={busy}>Corte del día</button>
            </div>
            {report ? (
              <div className="mt-4 text-sm">
                <p>Cuentas {report.tickets}. Alimentos {money(report.food)}. Propinas {money(report.tips)}.</p>
                <p>Descuentos {money(report.discounts)}. Devoluciones de este turno {money(report.refunds)}, aunque la cuenta se haya cobrado antes. Cancelaciones {report.cancellations}.</p>
                <ul className="mt-2 space-y-1">
                  {(report.by_method || []).map((row) => (
                    <li key={row.method}>{row.method}: {row.tickets} · {money(row.food)} · propina {money(row.tips)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </form>
        ) : null}
        <div className="card p-5">
          <h2 className="text-2xl">Cortes anteriores</h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {(history || []).length === 0 && savedCuts.length === 0 ? <li className="py-2 text-[var(--ink-soft)]">Aún no hay un corte guardado.</li> : null}
            {(history || []).map((h) => (
              <li key={h.id} className="py-3">
                <p className="font-bold">{h.closed_at ? new Date(h.closed_at).toLocaleString("es-MX") : "Abierto"}</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  Esperado {money(h.expected_cash)} · Contado {money(h.counted_cash)} · Diferencia {money(h.difference)}
                </p>
              </li>
            ))}
            {savedCuts.map((cut) => (
              <li key={cut.id} className="py-3">
                <p className="font-bold">{cut.kind === "dia" ? "Corte del día" : "Corte parcial"} · {cut.created_at ? new Date(cut.created_at).toLocaleString("es-MX") : ""}</p>
                <button type="button" className="btn-ghost mt-1 h-12" onClick={() => printCut(cut.kind === "dia" ? "Corte del día" : "Corte parcial", cut.snapshot, cut.snapshot?.counted, cut.notes)}>
                  Imprimir
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
