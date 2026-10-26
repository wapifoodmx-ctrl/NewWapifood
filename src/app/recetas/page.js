import { AppShell } from "@/components/AppShell";
import { getMembership, requireUser } from "@/lib/auth";

export default async function RecetasPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    return <AppShell title="Recetas"><p>Sin restaurante.</p></AppShell>;
  }
  const [{ data: products }, { data: ingredients }, { data: lines }] = await Promise.all([
    supabase.from("products").select("id,name").eq("restaurant_id", membership.restaurant_id),
    supabase.from("ingredients").select("id,name,unit").eq("restaurant_id", membership.restaurant_id),
    supabase.from("recipe_lines").select("*"),
  ]);
  const ingName = (id) => ingredients?.find((i) => i.id === id);
  const byProduct = (products || []).map((p) => ({
    ...p,
    lines: (lines || []).filter((l) => l.product_id === p.id),
  }));

  return (
    <AppShell title="Recetas" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">Migración de pages/recetas.js — receta = insumos por producto.</p>
      <div className="space-y-3">
        {byProduct.map((p) => (
          <article key={p.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
            <h3 className="text-xl">{p.name}</h3>
            {p.lines.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Sin receta</p>
            ) : (
              <ul className="mt-2 text-sm">
                {p.lines.map((l) => {
                  const ing = ingName(l.ingredient_id);
                  return (
                    <li key={`${l.product_id}-${l.ingredient_id}`}>
                      {l.qty} {ing?.unit} · {ing?.name || l.ingredient_id}
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
