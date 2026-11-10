"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TicketCard } from "@/components/TicketCard";
import { payLabel } from "@/lib/brand";

const FILTERS = [
  { id: "activas", label: "Abiertas" },
  { id: "pagada", label: "Pagadas" },
  { id: "cancelada", label: "Canceladas" },
  { id: "todas", label: "Todas" },
];

export function TicketsBoard({ orders, productNames, ivaEnabled = false }) {
  const [filter, setFilter] = useState("activas");
  const [query, setQuery] = useState("");
  const router = useRouter();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = filter === "todas"
      ? orders
      : filter === "activas"
        ? orders.filter((o) => !["pagada", "cancelada"].includes(o.status))
        : orders.filter((o) => o.status === filter);
    if (!q) return base;
    return base.filter((order) => {
      const folios = [order.folio, order.mp_payment_id, ...(order.order_payments || []).map((pay) => pay.folio || pay.mp_payment_id)].filter(Boolean).join(" ");
      return [order.public_code, payLabel(order.method), folios].join(" ").toLowerCase().includes(q);
    });
  }, [orders, filter, query]);

  return (
    <div>
      <label className="mb-3 block text-sm font-bold">
        Buscar folio, código o forma de pago
        <input className="mt-1 h-12 w-full max-w-md border px-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ejemplo: vale, 1842, otro" />
      </label>
      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-10 rounded-[3px] px-4 text-xs font-semibold uppercase tracking-wide ${
              filter === f.id
                ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                : "bg-[var(--color-paper)] text-[var(--color-onyx-warm)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {list.length === 0 ? (
          <p className="border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-5 text-[var(--color-espresso)]">
            No hay tickets en este filtro.
          </p>
        ) : (
          list.map((o) => (
            <TicketCard
              ivaEnabled={ivaEnabled}
              key={o.id}
              order={o}
              productNames={productNames}
              onChanged={() => router.refresh()}
            />
          ))
        )}
      </div>
    </div>
  );
}
