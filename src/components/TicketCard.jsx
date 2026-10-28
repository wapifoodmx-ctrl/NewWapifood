"use client";

import { useMemo } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import { statusMeta } from "@/lib/orderStatus";
import { createClient } from "@/lib/supabase/client";

export function TicketCard({ order, productNames = {}, onChanged }) {
  const meta = statusMeta(order.status);
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

  function whenLabel(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("es-MX");
    } catch {
      return String(iso);
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
    const code = order.public_code || order.id?.slice(0, 8);
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Ticket ${code}</title>
<style>body{font-family:ui-monospace,monospace;padding:16px;font-size:13px}
h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse}
.total{display:flex;justify-content:space-between;font-weight:700;margin-top:12px;border-top:1px dashed #999;padding-top:8px}
</style></head><body>
<h1>Wapifood · Mesa ${order.dining_tables?.number ?? "—"}</h1>
<p style="color:#555;font-size:11px">${meta.label} · ${order.method || ""} · ${whenLabel(order.closed_at || order.opened_at)}</p>
<p style="font-size:11px">Código: ${code}</p>
<table>${rows}</table>
<div class="total"><span>Total</span><span>${money(total)}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    w.document.close();
  }

  async function cancel() {
    if (order.status === "pagada" || order.status === "cancelada") return;
    const reason = prompt("Motivo de cancelación:", "Cancelada por el local");
    if (reason == null) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_order", {
      p_order: order.id,
      p_reason: reason,
    });
    if (error) {
      alert(error.message);
      return;
    }
    onChanged?.();
  }

  const canCancel = !["pagada", "cancelada"].includes(order.status);
  const beeperHref = `/t/${order.id}`;

  return (
    <article className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-semibold">Mesa {order.dining_tables?.number ?? "—"}</p>
            <span className={`rounded-[3px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm text-[var(--color-espresso)]" suppressHydrationWarning>
            {order.source ? `${order.source} · ` : ""}
            {order.method || "—"}
            {order.closed_at || order.opened_at ? ` · ${whenLabel(order.closed_at || order.opened_at)}` : ""}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-walnut)]">
            {order.public_code || order.id?.slice(0, 8)}
          </p>
          {order.cancel_reason ? (
            <p className="mt-1 text-xs text-[var(--color-wine)]">Motivo: {order.cancel_reason}</p>
          ) : null}
        </div>
        <p className="text-2xl font-semibold">{money(total)}</p>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-[var(--color-espresso)]">
        {(order.order_items || []).map((i) => (
          <li key={`${order.id}-${i.product_id}`}>
            {i.qty} × {productName(i.product_id)} — {money(Number(i.unit_price) * Number(i.qty))}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={printTicket} className="wf-btn h-10 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-4">
          Imprimir
        </button>
        <Link href={beeperHref} className="wf-btn flex h-10 items-center border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-4">
          Ver beeper
        </Link>
        {canCancel ? (
          <button type="button" onClick={cancel} className="wf-btn h-10 px-4 text-[var(--color-wine)]">
            Cancelar orden
          </button>
        ) : null}
      </div>
    </article>
  );
}
