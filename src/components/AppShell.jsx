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
    <div className="min-h-screen bg-[var(--color-parchment)] text-[var(--color-onyx-warm)]">
      {setupOnly ? (
        <div className="border-b border-[var(--color-saffron-glow)] bg-[var(--color-saffron-glow)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-midnight-roast)]">
          Modo configuración —{" "}
          <Link href="/pagos" className="underline">
            activa tu plan
          </Link>{" "}
          para vender
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-espresso)]">
              {restaurantName || "Wapifood"}
              {role ? ` · ${role}` : ""}
              {operational ? " · activo" : ""}
            </p>
            <h1 className="truncate text-[28px] font-normal leading-none sm:text-[32px]">{title}</h1>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="wf-btn h-11 shrink-0 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-4"
          >
            Salir
          </button>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-3">
          {MODULES.map((m) => {
            const on = pathname === m.href || (m.href !== "/" && pathname.startsWith(`${m.href}/`));
            const needsPlan = m.group === "ops" && setupOnly;
            return (
              <Link
                key={m.id}
                href={m.href}
                title={needsPlan ? "Requiere plan activo" : m.title}
                className={`flex h-10 shrink-0 items-center rounded-[3px] px-3 text-[12px] font-semibold uppercase tracking-[0.04em] ${
                  on
                    ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                    : "bg-[var(--color-parchment)] text-[var(--color-onyx-warm)]"
                }`}
              >
                {m.title}
                {needsPlan ? " · plan" : ""}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-20">{children}</main>
    </div>
  );
}
