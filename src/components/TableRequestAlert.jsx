"use client";

import { changeRequestQty } from "@/lib/tableMenu";

function extraNames(item) {
  return (item?.modifiers || []).map((mod) => mod?.name).filter(Boolean).join(", ");
}

export function TableRequestAlert({ alert, tableNumber, draft, onDraft, onSave, onReview }) {
  const mesa = tableNumber ? `Mesa ${tableNumber}` : "Mesa";
  const pedido = alert.kind === "pedido";
  const title = pedido
    ? `${mesa} · Por aceptar`
    : alert.kind === "mesero"
      ? `${mesa} · El cliente llama al mesero`
      : `${mesa} · Piden la cuenta`;
  const lines = draft || alert.items || [];

  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-lg font-bold">{title}</p>
      {pedido ? (
        <ul className="mt-2 grid gap-2">
          {lines.map((item, index) => (
            <li key={`${item.product_id || "linea"}-${index}`} className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-base font-semibold">
                {item.qty} × {item.name || "Platillo"}
                {extraNames(item) ? <span className="block text-sm font-medium text-[var(--ink-soft)]">{extraNames(item)}</span> : null}
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="h-12 w-12 rounded-full border border-[var(--border)] text-lg font-bold"
                  aria-label={`Quitar uno de ${item.name || "platillo"}`}
                  onClick={() => onDraft(changeRequestQty(lines, index, -1))}
                >
                  −
                </button>
                <button
                  type="button"
                  className="h-12 w-12 rounded-full border border-[var(--border)] text-lg font-bold"
                  aria-label={`Sumar uno de ${item.name || "platillo"}`}
                  onClick={() => onDraft(changeRequestQty(lines, index, 1))}
                >
                  +
                </button>
              </span>
            </li>
          ))}
          {!lines.length ? <li className="text-base">Para quitarlo todo, rechaza el pedido.</li> : null}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {pedido ? (
          <button type="button" className="btn-ghost h-12 px-4" onClick={() => onSave(lines)}>
            Guardar cambios
          </button>
        ) : null}
        <button type="button" className="btn-primary h-12 px-4" onClick={() => onReview(true)}>Aceptar</button>
        <button type="button" className="btn-ghost h-12 px-4" onClick={() => onReview(false)}>Rechazar</button>
      </div>
    </div>
  );
}
