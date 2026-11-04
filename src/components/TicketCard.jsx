"use client";

import { useMemo } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import { lineAmount } from "@/lib/extras";
import { confirmAsync } from "@/components/ui/confirm";
import { statusMeta } from "@/lib/orderStatus";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { OrderComments } from "@/components/OrderComments";
import { downloadTicketPdf } from "@/lib/ticketPdf";

export function TicketCard({ order, productNames = {}, onChanged }) {
  const meta = statusMeta(order.status);
  const total = useMemo(() => {
    const food = (order.order_items || []).reduce((s, i) => {
      if (order.status === "pagada" && i.status === "cancelado") {
        return s + lineAmount({ ...i, status: "pendiente" });
      }
      return s + lineAmount(i);
    }, 0);
    const discount = Number(order.discount_amount) || 0;
    const tip = Number(order.tip_amount) || 0;
    return Math.max(0, food - discount) + tip;
  }, [order.order_items, order.discount_amount, order.tip_amount, order.status]);

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
      toast.warning("Permite ventanas emergentes para imprimir.");
      return;
    }
    const rows = (order.order_items || [])
      .map((i) => {
        const line = Number(i.unit_price) * Number(i.qty);
        const note = i.notes ? `<div style="font-size:11px;color:#666">${i.notes}</div>` : "";
        return `<tr><td style="padding:6px 0;vertical-align:top">${i.qty} × ${productName(i.product_id)}${note}</td>
          <td style="padding:6px 0;text-align:right;vertical-align:top">${money(line)}</td></tr>`;
      })
      .join("");
    const code = order.public_code || order.id?.slice(0, 8);
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Ticket ${code}</title>
<style>body{font-family:ui-monospace,monospace;padding:16px;font-size:13px}
h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse}
.total{display:flex;justify-content:space-between;font-weight:700;margin-top:12px;border-top:1px dashed #999;padding-top:8px}
</style></head><body>
<h1>Wapifood</h1><p style="margin:0 0 8px;font-size:13px">Mesa ${order.dining_tables?.number ?? "—"} · ${(order.source||"pos").toUpperCase()}</p>
<p style="color:#555;font-size:11px">${meta.label} · ${order.method || ""} · ${whenLabel(order.closed_at || order.opened_at)}</p>
<p style="font-size:11px">Código: ${code}</p>
<table>${rows}</table>
<div class="total"><span>Total</span><span>${money(total)}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    w.document.close();
  }

  function pdfTicket() {
    const code = order.public_code || order.id?.slice(0, 8);
    const lines = [
      "Wapifood",
      `Mesa ${order.dining_tables?.number ?? "-"}  ${order.source || "pos"}`,
      `${meta.label}  ${order.method || ""}`,
      `Codigo ${code}`,
      "",
      ...(order.order_items || []).map(
        (i) => `${i.qty} x ${productName(i.product_id)}  ${money(Number(i.unit_price) * Number(i.qty))}`,
      ),
      "",
      `Total ${money(total)}`,
    ];
    downloadTicketPdf({ filename: `ticket-${code}.pdf`, lines });
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
      toast.error(error.message);
      return;
    }
    onChanged?.();
  }

  async function settleStock(item, asMerma) {
    const ok = await confirmAsync(
      asMerma
        ? "El inventario se queda descontado y se anota como merma. El dinero cobrado no cambia."
        : "Los insumos de este platillo regresan al stock. El dinero cobrado no cambia.",
      {
        title: asMerma ? "Dejar como merma" : "Devolver al inventario",
        confirmLabel: asMerma ? "Anotar merma" : "Devolver",
        cancelLabel: "Cancelar",
      },
    );
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("return_sold_stock", {
      p_order: order.id,
      p_product: item.product_id,
      p_as_merma: asMerma,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(asMerma ? "Quedó como merma" : "Inventario devuelto");
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
            <span className={`chip ${meta.color}`}>
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
          {order.order_type === "domicilio" ? (
            <p className="mt-1 text-xs text-[var(--color-saffron-glow)]">
              Domicilio: {order.delivery_address || "—"}
              {order.customer_phone ? ` · ${order.customer_phone}` : ""}
            </p>
          ) : null}
          {order.cancel_reason ? (
            <p className="mt-1 text-xs text-[var(--color-wine)]">Motivo: {order.cancel_reason}</p>
          ) : null}
        </div>
        <p className="text-2xl font-semibold">{money(total)}</p>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-[var(--color-espresso)]">
        {(order.order_items || []).map((i) => (
          <li key={`${order.id}-${i.product_id}`} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {i.qty} × {productName(i.product_id)} — {money(lineAmount(i))}
              {i.status === "cancelado" ? " · cancelado" : ""}
              {i.stock_resolution === "devuelto" ? " · inventario devuelto" : ""}
              {i.stock_resolution === "merma" ? " · merma" : ""}
            </span>
            {order.status === "pagada" && i.status !== "cancelado" && !i.stock_resolution ? (
              <span className="flex gap-2">
                <button type="button" className="btn-ghost px-2" onClick={() => settleStock(i, false)}>Devolver inventario</button>
                <button type="button" className="btn-ghost px-2" onClick={() => settleStock(i, true)}>Merma</button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={printTicket} className="wf-btn h-10 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-4">
          Imprimir
        </button>
        <button type="button" onClick={pdfTicket} className="wf-btn h-10 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-4">
          PDF
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
      <OrderComments orderId={order.id} />
    </article>
  );
}