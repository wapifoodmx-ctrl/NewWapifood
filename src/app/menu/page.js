export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Menú cliente público (antes clientmenu / webmenu). Por ahora lista la carta del demo. */
export default async function ClientMenuPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("name,price,active")
    .eq("active", true)
    .limit(50);

  return (
    <div className="min-h-screen bg-[var(--color-cream)] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-ember)]">Menú digital</p>
        <h1 className="mt-2 text-4xl">Carta del cliente</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Equivale a clientmenu / webmenu. El carrito y pago QR van en el siguiente bloque.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)]">
          {(products || []).length === 0 ? (
            <p className="p-4 text-[var(--color-muted)]">Sin productos visibles (RLS o seed).</p>
          ) : (
            (products || []).map((p) => (
              <div key={p.name} className="flex justify-between border-b border-[var(--color-line)] px-4 py-3 last:border-0">
                <span className="font-semibold">{p.name}</span>
                <span>{money(p.price)}</span>
              </div>
            ))
          )}
        </div>
        <p className="mt-6 text-center text-sm">
          <a href="/dashboard" className="font-semibold">Ir al panel</a>
        </p>
      </div>
    </div>
  );
}
