"use client";

import { useMemo } from "react";
import { money } from "@/lib/format";

export function TicketCard({ order, productNames = {} }) {
  const total = useMemo(
    () =>
      (order.order_items || []).reduce(
        (s, i) => s + Number(i.unit_price) * Number(i.qty),
        0,
      ),
    [order.order_items],
  );

  function productName(id) {
    return productNames[id] || "Producto";
  }

  function closedLabel() {
    if (!order.closed_at) return "";
    try {
      return new Date(order.closed_at).toLocaleString("es-MX");
    } catch {
      return String(order.closed_at);
    }
  }

  function printTicket() {
    const w = window.open("", "_blank", "width=360,height=640");
    if (!w) {
      alert("Permite ventanas emergentes para imprimir.");
      return;
    }
    const rows = (order.order_items || [])
      .map((i) => {
        const line = Number(i.unit_price) * Number(i.qty);
        return `<tr><td style="padding:4px 0">${i.qty} × ${productName(i.product_id)}</td>
          <td style="padding:4px 0;text-align:right">${money(line)}</td></tr>`;
      })
      .join("");

    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Ticket</title>
<style>body{font-family:ui-monospace,monospace;padding:16px;font-size:13px}
h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse}
.total{display:flex;justify-content:space-between;font-weight:700;margin-top:12px;border-top:1px dashed #999;padding-top:8px}
</style></head><body>
<h1>Wapifood · Mesa ${order.dining_tables?.number ?? "—"}</h1>
<p style="color:#555;font-size:11px">${order.method || ""} · ${closedLabel()}</p>
<table>${rows}</table>
<div class="total"><span>Total</span><span>${money(total)}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    w.document.close();
  }

  return (
    <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xl font-semibold">Mesa {order.dining_tables?.number ?? "—"}</p>
          <p className="text-sm text-[var(--color-muted)]" suppressHydrationWarning>
            {order.method || "—"}
            {order.closed_at ? ` · ${closedLabel()}` : ""}
          </p>
        </div>
        <p className="text-2xl font-semibold">{money(total)}</p>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-[var(--color-muted)]">
        {(order.order_items || []).map((i) => (
          <li key={`${order.id}-${i.product_id}`}>
            {i.qty} × {productName(i.product_id)} — {money(Number(i.unit_price) * Number(i.qty))}
          </li>
        ))}
      </ul>
      <button type="button" onClick={printTicket} className="mt-3 h-10 rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">
        Imprimir ticket
      </button>
    </article>
  );
}
