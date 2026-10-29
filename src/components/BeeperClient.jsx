"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { statusMeta } from "@/lib/orderStatus";

export function BeeperClient({
  orderId,
  initialStatus,
  restaurantName,
  tableNumber,
  publicCode,
  cancelReason,
  items,
  total,
  metaLabel,
  metaDetail,
}) {
  const [status, setStatus] = useState(initialStatus);
  const meta = statusMeta(status);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`beeper-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          if (payload.new?.status) setStatus(payload.new.status);
        },
      )
      .subscribe();

    const t = setInterval(async () => {
      const { data } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
      if (data?.status) setStatus(data.status);
    }, 10000);

    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] px-4 py-10 text-[var(--color-onyx-warm)]">
      <div className="mx-auto max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-saffron-glow)]">
          {restaurantName}
        </p>
        <h1 className="mt-2 text-4xl font-normal">Tu pedido</h1>
        <p className="mt-1 text-sm text-[var(--color-espresso)]">
          Mesa {tableNumber ?? "—"} · código {publicCode || orderId.slice(0, 8)}
        </p>
        <div className={`mt-6 rounded-[3px] px-4 py-4 text-[var(--color-parchment)] ${meta.color}`}>
          <p className="text-xs font-bold uppercase tracking-wide opacity-90">Estado</p>
          <p className="text-2xl font-semibold">{meta.label || metaLabel}</p>
          <p className="mt-1 text-sm opacity-90">{meta.detail || metaDetail}</p>
        </div>
        {status === "cancelada" && cancelReason ? (
          <p className="mt-3 text-sm text-[var(--color-wine)]">Motivo: {cancelReason}</p>
        ) : null}
        <ul className="mt-6 space-y-2 border-t border-[var(--color-warm-stone)] pt-4 text-sm">
          {items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>
                {i.qty} × {i.name}
              </span>
              <span>{money(i.line)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{money(total)}</span>
        </p>
        <p className="mt-6 text-center text-xs text-[var(--color-walnut)]">
          Esta pantalla se actualiza sola. No hace falta recargar.
        </p>
      </div>
    </div>
  );
}
