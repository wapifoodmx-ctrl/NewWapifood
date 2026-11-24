"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { statusMeta } from "@/lib/orderStatus";
import { itemWord } from "@/lib/tableMenu";

/**
 * Ticket digital / beeper — status de ORDEN e ÍTEMS siempre visibles y en vivo.
 */
export function BeeperClient({
  orderId,
  initialStatus,
  restaurantName,
  tableNumber,
  publicCode,
  cancelReason,
  items: initialItems,
  total,
}) {
  const [status, setStatus] = useState(initialStatus);
  const [items, setItems] = useState(initialItems || []);
  const meta = statusMeta(status);
  const shownTotal = (items || []).reduce((sum, item) => {
    if ((item.status || "pendiente") === "cancelado") return sum;
    const extras = (item.extras || []).reduce((s, extra) => s + Number(extra.extra_price || 0), 0);
    return sum + (Number(item.unit_price) + extras) * Number(item.qty);
  }, 0);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_public_ticket", { p_order: orderId });
    if (error || !data) return;
    if (data.status) setStatus(data.status);
    if (data.items) setItems(data.items);
  }

  useEffect(() => {
    const kick = setTimeout(() => {
      refresh();
    }, 0);
    const t = setInterval(refresh, 8000);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[var(--bg)] px-4 py-10 text-[var(--ink)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-saffron-glow)]">
        {restaurantName || "Wapifood"}
      </p>
      <h1 className="mt-2 text-3xl">Tu pedido</h1>
      <p className="mt-1 text-sm text-[var(--color-espresso)]">
        {tableNumber != null ? `Mesa ${tableNumber}` : "Pedido"}
        {publicCode ? ` · Código ${publicCode}` : ""}
      </p>

      <div className={`mt-6 rounded-3xl px-4 py-4 ${meta.banner}`}>
        <p className="text-base font-bold">Estado</p>
        <p className="text-3xl">{meta.label}</p>
        <p className="text-sm opacity-90">{meta.detail}</p>
      </div>

      {status === "cancelada" && cancelReason ? (
        <p className="mt-3 text-sm text-[var(--color-wine)]">Motivo: {cancelReason}</p>
      ) : null}

      <ul className="mt-6 space-y-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
        {(items || []).map((i) => {
          const im = itemWord(i.status || "pendiente");
          const tone = im.tone === "ok"
            ? "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-fg)]"
            : im.tone === "bad"
              ? "bg-[var(--chip-bad-bg)] text-[var(--chip-bad-fg)]"
              : "bg-[var(--chip-warn-bg)] text-[var(--chip-warn-fg)]";
          return (
            <li key={`${i.product_id}-${i.name}`} className="flex items-start justify-between gap-2 text-base">
              <div>
                <p>
                  <span className="font-semibold">{i.qty}×</span> {i.name}
                </p>
                {i.notes ? <p className="text-sm text-[var(--primary)]">{i.notes}</p> : null}
                {(i.extras || []).map((extra) => (
                  <p key={extra.ingredient_id || extra.name} className="text-sm text-[var(--ink-soft)]">
                    + {extra.name}
                  </p>
                ))}
                <p className={`chip mt-1 ${tone}`}>{im.word}</p>
              </div>
              <span className="font-semibold">{money((Number(i.unit_price) + (i.extras || []).reduce((sum, extra) => sum + Number(extra.extra_price || 0), 0)) * Number(i.qty))}</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex justify-between text-lg font-semibold">
        <span>Total</span>
        <span>{money(shownTotal || total)}</span>
      </p>

      <p className="mt-8 text-center text-xs text-[var(--color-walnut)]">
        Esta pantalla se actualiza sola. Puedes dejarla abierta mientras esperas.
      </p>
    </div>
  );
}
