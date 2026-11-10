"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { payLabel } from "@/lib/brand";
import { toast } from "@/components/ui/Toast";

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

export function PropinasPanel({ restaurantId }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [mode, setMode] = useState("individual");
  const [percents, setPercents] = useState({});
  const [busy, setBusy] = useState(false);

  async function load(e) {
    e?.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("tip_report", {
      p_restaurant: restaurantId,
      p_from: from,
      p_to: to,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setReport(data);
  }

  function printShares(shares, total) {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return toast.error("El navegador bloqueó la ventana");
    const rows = (shares || []).map((row) => `<tr><td>${row.waiter}</td><td>${row.amount}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reparto de propinas</title></head><body><h1>Reparto de propinas</h1><p>${from} a ${to}. Total ${total}.</p><table>${rows}</table></body></html>`);
    popup.document.close();
    popup.print();
  }

  async function closePayout() {
    const shares = mode === "porcentaje"
      ? (report?.by_waiter || []).map((row) => ({
        waiter_id: row.waiter_id,
        waiter: row.waiter,
        percent: Number(percents[row.waiter_id || row.waiter] || 0),
      }))
      : [];
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("close_tip_payout", {
      p_restaurant: restaurantId,
      p_from: from,
      p_to: to,
      p_mode: mode,
      p_shares: shares,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reparto guardado");
    const preview = mode === "individual" ? report.by_waiter : report.by_waiter;
    printShares(preview, report.total);
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={load} className="card flex flex-wrap items-end gap-3 p-5">
        <label className="text-sm font-bold">Desde<input type="date" className="mt-1 h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm font-bold">Hasta<input type="date" className="mt-1 h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="submit" className="btn-primary h-12" disabled={busy}>Ver propinas</button>
      </form>
      <p className="text-base text-[var(--ink-soft)]">Por horas usa el checador. Si nadie marcó entrada, no se reparte. El reparto igual es entre quienes recibieron propina en estas fechas.</p>
      {report ? (
        <section className="card p-5">
          <h2 className="text-2xl">Total {money(report.total)}</h2>
          <ul className="mt-2 text-sm">
            {(report.by_method || []).map((row) => (
              <li key={row.method}>{payLabel(row.method)}: {money(row.amount)}</li>
            ))}
          </ul>
          <ul className="mt-3 space-y-2">
            {(report.by_waiter || []).map((row) => (
              <li key={row.waiter_id || row.waiter} className="flex flex-wrap items-center justify-between gap-2">
                <span>{row.waiter}: {row.tickets} cuentas · {money(row.amount)}</span>
                {mode === "porcentaje" ? (
                  <label className="text-sm font-bold">%
                    <input className="ml-2 h-12 w-20 rounded-[14px] border border-[var(--border)] px-2" inputMode="numeric" value={percents[row.waiter_id || row.waiter] || ""} onChange={(e) => setPercents((prev) => ({ ...prev, [row.waiter_id || row.waiter]: e.target.value.replace(/\D/g, "") }))} />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" className="h-12 rounded-[14px] border border-[var(--border)]" onClick={() => setMode("individual")}>{mode === "individual" ? "● " : ""}Cada quien la suya</button>
            <button type="button" className="h-12 rounded-[14px] border border-[var(--border)]" onClick={() => setMode("iguales")}>{mode === "iguales" ? "● " : ""}Bote, partes iguales</button>
            <button type="button" className="h-12 rounded-[14px] border border-[var(--border)]" onClick={() => setMode("porcentaje")}>{mode === "porcentaje" ? "● " : ""}Bote, por porcentaje</button>
            <button type="button" className="h-12 rounded-[14px] border border-[var(--border)]" onClick={() => setMode("horas")}>{mode === "horas" ? "● " : ""}Bote, por horas</button>
          </div>
          <button type="button" className="btn-primary mt-4 h-14" disabled={busy} onClick={closePayout}>Cerrar reparto e imprimir</button>
        </section>
      ) : null}
    </div>
  );
}
