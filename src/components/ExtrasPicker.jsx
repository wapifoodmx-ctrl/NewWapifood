"use client";

import { money } from "@/lib/format";
import { formatExtraLabel } from "@/lib/extras";

export function ExtrasPicker({ extras, selected, onToggle }) {
  if (!extras?.length) return null;
  const picked = selected || [];

  return (
    <fieldset className="mt-4">
      <legend className="text-base font-bold text-[var(--ink)]">
        Adicionales
      </legend>
      <ul className="mt-2 space-y-2">
        {extras.map((extra) => {
          const on = picked.some((s) => s.ingredient_id === extra.ingredient_id);
          return (
            <li key={extra.ingredient_id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(extra)}
                  className="h-4 w-4 accent-[var(--color-onyx-warm)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{extra.name}</span>
                  <span className="text-xs text-[var(--color-espresso)]">
                    {Number(extra.qty) || 1}
                    {extra.unit ? ` ${extra.unit}` : ""} por pieza
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{money(extra.extra_price || 0)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function ExtrasLines({ extras }) {
  if (!extras?.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {extras.map((extra) => (
        <li key={extra.ingredient_id || extra.name} className="text-xs text-[var(--color-espresso)]">
          + {formatExtraLabel(extra)}
        </li>
      ))}
    </ul>
  );
}
