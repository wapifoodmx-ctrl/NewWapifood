"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { createClient } from "@/lib/supabase/client";

export function AppShell({
  children,
  title,
  restaurantName,
  role,
  operational = false,
  setupOnly = false,
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">
      {setupOnly ? (
        <div className="border-b border-[var(--color-ember)] bg-[var(--color-ember)] px-4 py-2 text-center text-sm font-semibold text-white">
          Modo configuración — arma tu restaurante.{" "}
          <Link href="/pagos" className="underline">
            Activa el plan
          </Link>{" "}
          para vender (POS, tickets, menú QR, kiosko, meseros).
        </div>
      ) : null}
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              {restaurantName || "Wapifood"}
              {role ? ` · ${role}` : ""}
              {operational ? " · plan activo" : ""}
            </p>
            <h1 className="text-2xl leading-none">{title}</h1>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="h-11 rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] px-4 text-sm font-semibold"
          >
            Salir
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-3">
          {MODULES.map((m) => {
            const on = pathname === m.href || (m.href !== "/" && pathname.startsWith(m.href + "/"));
            const needsPlan = m.group === "ops" && setupOnly;
            return (
              <Link
                key={m.id}
                href={m.href}
                className={`flex h-10 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${
                  on
                    ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                    : "bg-[var(--color-cream)] text-[var(--color-ink)]"
                }`}
                title={needsPlan ? "Requiere plan activo" : m.title}
              >
                {m.title}
                {needsPlan ? " 🔒" : ""}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
