import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MODULES } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let health = "sin configurar";
  let restaurantName = null;
  let productCount = null;
  let tableCount = null;

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = await createClient();
      const { data: restaurants, error } = await supabase
        .from("restaurants")
        .select("id,name")
        .limit(1);
      if (error) {
        health = `conectado · ${error.message}`;
      } else {
        health = "conectado a Supabase";
        restaurantName = restaurants?.[0]?.name ?? "sin filas visibles (falta membership)";
        const [{ count: pc }, { count: tc }] = await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }),
          supabase.from("dining_tables").select("*", { count: "exact", head: true }),
        ]);
        productCount = pc;
        tableCount = tc;
      }
    }
  } catch (e) {
    health = `error · ${e?.message ?? "desconocido"}`;
  }

  return (
    <AppShell title="Operación">
      <section className="mb-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Estado
        </p>
        <h2 className="mt-1 text-3xl">Refactor del SaaS sin perder módulos</h2>
        <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
          Este repo concentra Front + API + microservicio de inventarios en
          Next.js + Supabase. El mapa de abajo es el inventario de
          funcionalidades del sistema anterior; se migran una a una.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--color-cream)] p-3">
            <dt className="text-sm text-[var(--color-muted)]">Supabase</dt>
            <dd className="font-semibold">{health}</dd>
          </div>
          <div className="rounded-xl bg-[var(--color-cream)] p-3">
            <dt className="text-sm text-[var(--color-muted)]">Restaurante visible</dt>
            <dd className="font-semibold">{restaurantName ?? "—"}</dd>
          </div>
          <div className="rounded-xl bg-[var(--color-cream)] p-3">
            <dt className="text-sm text-[var(--color-muted)]">Productos / mesas</dt>
            <dd className="font-semibold">
              {productCount ?? "—"} / {tableCount ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-2xl">Módulos del SaaS</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => (
            <article
              key={m.id}
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl">{m.title}</h3>
                <span className="rounded-full bg-[var(--color-cream)] px-2 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  {m.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{m.description}</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Legacy: {m.legacy.join(" · ")}
              </p>
              {m.href !== "#" ? (
                <Link
                  href={m.href}
                  className="mt-3 inline-flex h-10 items-center rounded-full bg-[var(--color-ink)] px-4 text-sm font-semibold text-[var(--color-cream)]"
                >
                  Abrir
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
