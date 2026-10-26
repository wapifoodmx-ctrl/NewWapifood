import { AppShell } from "@/components/AppShell";
import { RestockButton } from "@/components/RestockButton";
import { getMembership, requireUser } from "@/lib/auth";

export default async function InsumosPage() {
  const { supabase, user } = await requireUser();
  const membership = await getMembership(supabase, user.id);
  if (!membership?.restaurant_id) {
    return <AppShell title="Insumos"><p>Sin restaurante.</p></AppShell>;
  }
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("*")
    .eq("restaurant_id", membership.restaurant_id)
    .order("name");

  return (
    <AppShell title="Insumos" restaurantName={membership.restaurants?.name} role={membership.role}>
      <p className="mb-4 max-w-2xl text-[var(--color-muted)]">
        Reemplaza el microservicio de inventarios. El stock se descuenta al cobrar con{" "}
        <code>close_order</code>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(ingredients || []).map((ing) => {
          const low = Number(ing.stock) <= Number(ing.min_stock);
          return (
            <article key={ing.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl">{ing.name}</h3>
                  <p className="text-sm text-[var(--color-muted)]">
                    mínimo {ing.min_stock} {ing.unit}
                  </p>
                </div>
                <p className={`text-2xl font-semibold ${low ? "text-[var(--color-wine)]" : ""}`}>
                  {ing.stock}
                  <span className="ml-1 text-sm font-normal text-[var(--color-muted)]">{ing.unit}</span>
                </p>
              </div>
              {low ? <p className="mt-2 text-sm font-semibold text-[var(--color-wine)]">Bajo mínimo</p> : null}
              <RestockButton ingredientId={ing.id} unit={ing.unit} />
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
