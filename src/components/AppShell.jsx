"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MODULES, NAV_GROUPS, primaryModules } from "@/lib/modules";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { HelpChat } from "@/components/HelpChat";

const ROLE_LABEL = {
  owner: "dueño",
  admin: "administrador",
  piso: "piso",
  cocina: "cocina",
};

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
  const [more, setMore] = useState(false);
  const primary = primaryModules(role);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function itemClass(href, compact = false) {
    const on = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
    return `flex min-h-12 items-center justify-center rounded-[3px] px-3 text-sm font-semibold ${
      compact ? "min-w-[4.5rem] flex-1" : ""
    } ${on ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]" : "bg-[var(--color-paper)] text-[var(--color-onyx-warm)]"}`;
  }

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-onyx-warm)]">
      {setupOnly ? (
        <div className="bg-[var(--color-onyx-warm)] px-4 py-3 text-center text-sm text-[var(--color-parchment)]">
          Todavía no puedes vender.{" "}
          <Link href="/pagos" className="font-semibold underline">
            Elige un plan
          </Link>
          {" o "}
          <Link href="/empezar" className="font-semibold underline">
            termina la configuración
          </Link>
          .
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-[var(--color-warm-stone)] bg-[var(--color-paper)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-[var(--color-muted)]">
              {restaurantName || "Wapifood"}
              {role ? ` · ${ROLE_LABEL[role] || role}` : ""}
            </p>
            <h1 className="truncate text-[1.75rem] font-normal leading-tight sm:text-[2rem]">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button type="button" onClick={signOut} className="wf-btn border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-4">
              Salir
            </button>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-6xl gap-6 px-4 pb-4 lg:flex" aria-label="Secciones">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{group.label}</p>
              <div className="flex flex-wrap gap-1">
                {MODULES.filter((m) => m.nav === group.id).map((m) => (
                  <Link key={m.id} href={m.href} className={itemClass(m.href)}>
                    {m.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-2 lg:hidden" aria-label="Accesos rápidos">
        <div className="mx-auto flex max-w-6xl gap-1">
          {primary.map((m) => (
            <Link key={m.id} href={m.href} className={itemClass(m.href, true)}>
              {m.title}
            </Link>
          ))}
          <button type="button" className={itemClass("/mas", true)} onClick={() => setMore((v) => !v)} aria-expanded={more}>
            Más
          </button>
        </div>
        {more ? (
          <div className="mx-auto mt-2 max-h-[50vh] max-w-6xl space-y-3 overflow-y-auto border-t border-[var(--color-warm-stone)] pt-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="px-1 text-xs font-semibold uppercase text-[var(--color-muted)]">{group.label}</p>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {MODULES.filter((m) => m.nav === group.id).map((m) => (
                    <Link key={m.id} href={m.href} onClick={() => setMore(false)} className={itemClass(m.href)}>
                      {m.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </nav>
      <HelpChat />
    </div>
  );
}
