"use client";

export function StockMovesList({ moves, ingredientNames }) {
  if (!moves?.length) {
    return (
      <p className="mt-2 text-sm text-[var(--color-espresso)]">
        Aún no hay movimientos. Se registran con entradas, mermas o al cobrar ventas con receta.
      </p>
    );
  }

  return (
    <div className="overflow-hidden border border-[var(--color-warm-stone)] bg-[var(--color-paper)]">
      {moves.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between border-b border-[var(--color-warm-stone)] px-4 py-3 text-sm last:border-0"
        >
          <div>
            <p className="font-semibold">{ingredientNames[m.ingredient_id] || "Insumo"}</p>
            <p className="text-[var(--color-walnut)]" suppressHydrationWarning>
              {m.reason || "movimiento"}
              {m.created_at ? ` · ${new Date(m.created_at).toLocaleString("es-MX")}` : ""}
            </p>
          </div>
          <p
            className={`font-semibold ${
              Number(m.qty) < 0 ? "text-[var(--color-wine)]" : "text-[var(--color-sage)]"
            }`}
          >
            {Number(m.qty) > 0 ? "+" : ""}
            {m.qty}
          </p>
        </div>
      ))}
    </div>
  );
}
