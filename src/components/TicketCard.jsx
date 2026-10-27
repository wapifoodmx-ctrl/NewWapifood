"use client";

import { money } from "@/lib/format";

export function TicketCard({ order, nameOf }) {
  const total = (order.order_items || []).reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.qty),
    0,
  );

  function printTicket() {
    const w = window.open("", "_blank", "width=360,height=600");
    if (!w) return;
    const rows = (order.order_items || [])
      .map(
        (i) =>
          `<tr><td>${i.qty} x ${nameOf(i.product_id)}</td><td style="text-align:right">${money(
            Number(i.unit_price) * Number(i.qty),
          )}</td></tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>Ticket</title>
      <style>
        body{font-family:ui-monospace,monospace;padding:16px;color:#111}
        h1{font-size:16px;margin:0 0 8px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        td{padding:4px 0}
        .total{font-weight:700;margin-top:12px;display:flex;justify-content:space-between}
      </style></head><body>
      <h1>Wapifood · Mesa ${order.dining_tables?.number ?? "—"}</h1>
      <p style="font-size:11px;margin:0 0 12px">${order.method || ""} · ${
        order.closed_at ? new Date(order.closed_at).toLocaleString("es-MX") : ""
      }</p>
      <table>${rows}</table>
      <div class="total"><span>Total</span><span>${money(total)}</span></div>
      <script>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xl font-semibold">Mesa {order.dining_tables?.number ?? "—"}</p>
          <p className="text-sm text-[var(--color-muted)]">
            {order.method || "—"} · {order.closed_at ? new Date(order.closed_at).toLocaleString("es-MX") : ""}
          </p>
        </div>
        <p className="text-2xl font-semibold">{money(total)}</p>
      </div>
      <ul className="mt-2 text-sm text-[var(--color-muted)]">
        {(order.order_items || []).map((i) => (
          <li key={`${order.id}-${i.product_id}`}>
            {i.qty} × {nameOf(i.product_id)} — {money(Number(i.unit_price) * Number(i.qty))}
          </li>
        ))}
      </ul>
      <button type="button" onClick={printTicket} className="mt-3 h-10 rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">
        Imprimir ticket
      </button>
    </article>
  );
}
