export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { money } from "@/lib/format";
import { getMembership, requireUser } from "@/lib/auth";

export default async function CartaPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    return <AppShell title="Carta"><p>Sin restaurante.</p></AppShell>;
  }
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("restaurant_id", membership.restaurant_id).order("name"),
    supabase.from("categories").select("*").eq("restaurant_id", membership.restaurant_id),
  ]);
  const catName = (id) => categories?.find((c) => c.id === id)?.name || "Sin categoría";

  return (
    <AppShell title="Carta" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 text-[var(--color-muted)]">
        Equivale a <code>pages/menu.js</code> del main de Comanadas.
      </p>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)]">
        {(products || []).map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3 last:border-0">
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{catName(p.category_id)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{money(p.price)}</p>
              <p className="text-sm text-[var(--color-muted)]">costo {money(p.cost)}</p>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
