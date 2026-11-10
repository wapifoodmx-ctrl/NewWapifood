"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { toast } from "@/components/ui/Toast";

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

export function ReportesPanel({ restaurantId }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [group, setGroup] = useState(null);
  const [scope, setScope] = useState("local");
  const [busy, setBusy] = useState(false);

  async function load(e) {
    e?.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const rpc = scope === "grupo" ? "sales_report_locations" : "sales_report";
    const { data, error } = await supabase.rpc(rpc, {
      p_restaurant: restaurantId,
      p_from: from,
      p_to: to,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (scope === "grupo") {
      setGroup(data);
      setReport(null);
      return;
    }
    setGroup(null);
    setReport(data);
  }

  function download() {
    if (!report) return;
    const lines = [
      "metodo,tickets,alimentos,propinas",
      ...(report.by_method || []).map((m) => `${m.method},${m.tickets},${m.food},${m.tips}`),
      "",
      "mesero,tickets,alimentos",
      ...(report.by_waiter || []).map((w) => `"${String(w.waiter).replaceAll('"', '""')}",${w.tickets},${w.food}`),
      "",
      "platillo,cantidad,alimentos",
      ...(report.top_products || []).map((p) => `"${String(p.name).replaceAll('"', '""')}",${p.qty},${p.food}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={load} className="card flex flex-wrap items-end gap-3 p-5">
        <label className="text-sm font-bold">
          Desde
          <input type="date" className="mt-1 h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm font-bold">
          Hasta
          <input type="date" className="mt-1 h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-sm font-bold">
          Qué ver
          <select className="mt-1 h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2" value={scope} onChange={(e) => { setScope(e.target.value); setReport(null); setGroup(null); }}>
            <option value="local">Este local</option>
            <option value="grupo">Todos los locales a los que entro</option>
          </select>
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Calculando…" : "Ver ventas"}</button>
        {report ? (
          <button type="button" className="btn-ghost" onClick={download}>Descargar CSV</button>
        ) : null}
      </form>
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Cuentas cobradas</p><p className="text-3xl font-extrabold">{report.tickets}</p></article>
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Alimentos</p><p className="text-3xl font-extrabold">{money(report.food)}</p></article>
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Propinas</p><p className="text-3xl font-extrabold">{money(report.tips)}</p></article>
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Descuentos</p><p className="text-3xl font-extrabold">{money(report.discounts)}</p></article>
          </div>
          <p className="text-base text-[var(--ink-soft)]">
            Margen estimado {money(report.margin_estimate)}. Es precio de venta menos el costo capturado en el platillo, sin restar descuentos ni sumar propina. No usa el costo de la receta.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            <List title="Por forma de pago" rows={(report.by_method || []).map((m) => `${m.method}: ${m.tickets} · ${money(m.food)}`)} />
            <List title="Por mesero" rows={(report.by_waiter || []).map((m) => `${m.waiter}: ${m.tickets} · ${money(m.food)}`)} />
            <List title="Platillos, antes de descuentos" rows={(report.top_products || []).map((m) => `${m.qty}× ${m.name} · ${money(m.food)}`)} />
          </div>
        </>
      ) : null}
      {group ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Cuentas cobradas</p><p className="text-3xl font-extrabold">{group.tickets}</p></article>
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Alimentos</p><p className="text-3xl font-extrabold">{money(group.food)}</p></article>
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Propinas</p><p className="text-3xl font-extrabold">{money(group.tips)}</p></article>
            <article className="card p-4"><p className="text-sm text-[var(--ink-soft)]">Descuentos</p><p className="text-3xl font-extrabold">{money(group.discounts)}</p></article>
          </div>
          <section className="card p-4">
            <h2 className="text-xl">Por local</h2>
            <ul className="mt-2 space-y-2">
              {(group.locations || []).length === 0 ? <li className="text-[var(--ink-soft)]">Sin locales en el grupo.</li> : null}
              {(group.locations || []).map((loc) => (
                <li key={loc.restaurant_id} className="text-base">
                  {loc.name}: {loc.tickets} cuentas · {money(loc.food)} · propina {money(loc.tips)}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function List({ title, rows }) {
  return (
    <section className="card p-4">
      <h2 className="text-xl">{title}</h2>
      <ul className="mt-2 space-y-2">
        {rows.length === 0 ? <li className="text-[var(--ink-soft)]">Sin datos en el rango.</li> : null}
        {rows.map((row) => (
          <li key={row} className="text-base">{row}</li>
        ))}
      </ul>
    </section>
  );
}
