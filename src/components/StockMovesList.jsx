"use client";

export function StockMovesList({ moves, ingredientNames }) {
  if (!moves?.length) {
    return (
      <p className="mt-6 text-sm text-[var(--color-muted)]">
        Aún no hay movimientos de stock. Se registran al cobrar (close_order) o al hacer entradas.
      </p>
    );
  }
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-2xl">Movimientos recientes</h2>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)]">
        {moves.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3 text-sm last:border-0">
            <div>
              <p className="font-semibold">{ingredientNames[m.ingredient_id] || "Insumo"}</p>
              <p className="text-[var(--color-muted)]">
                {m.reason} · {m.created_at ? new Date(m.created_at).toLocaleString("es-MX") : ""}
              </p>
            </div>
            <p className={`font-semibold ${Number(m.qty) < 0 ? "text-[var(--color-wine)]" : "text-[var(--color-sage)]"}`}>
              {Number(m.qty) > 0 ? "+" : ""}
              {m.qty}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
