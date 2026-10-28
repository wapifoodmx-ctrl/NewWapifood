"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TicketCard } from "@/components/TicketCard";

const FILTERS = [
  { id: "activas", label: "Activas" },
  { id: "pagada", label: "Pagadas" },
  { id: "cancelada", label: "Canceladas" },
  { id: "todas", label: "Todas" },
];

export function TicketsBoard({ orders, productNames }) {
  const [filter, setFilter] = useState("activas");
  const router = useRouter();

  const list = useMemo(() => {
    if (filter === "todas") return orders;
    if (filter === "activas") {
      return orders.filter((o) => !["pagada", "cancelada"].includes(o.status));
    }
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  return (
    <div>
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
