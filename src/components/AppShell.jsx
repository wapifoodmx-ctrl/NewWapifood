"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MODULES, NAV_GROUPS, homePath, primaryModules, roleLabel } from "@/lib/modules";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { HelpChat } from "@/components/HelpChat";
import { Icon } from "@/components/ui/Icon";

export function AppShell({
  children,
  title,
  restaurantName,
  role,
  operational = false,
  setupOnly = false,
  focus = false,
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

  function current(href) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  const home = homePath(role);

  const nav = (
    <nav aria-label="Secciones" className="grid gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-1 px-2 text-sm font-bold text-[var(--ink-soft)]">{group.label}</p>
          <div className="grid gap-1">
            {MODULES.filter((m) => m.nav === group.id).map((m) => (
              <Link
                key={m.id}
                href={m.href}
                aria-current={current(m.href) ? "page" : undefined}
                className="nav-link"
                onClick={() => setMore(false)}
              >
                <Icon name={m.icon} size={22} />
                <span>{m.title}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className={`app-frame min-h-screen bg-[var(--bg)] text-[var(--ink)] ${focus ? "focus" : "lg:flex"}`}>
      {focus ? null : (
        <aside className="app-side hidden lg:flex lg:min-h-screen lg:flex-col">
          <div className="px-4 pb-2 pt-5">
            <Link href={home} className="brand text-2xl text-[var(--ink)] no-underline">
              Wapifood
            </Link>
            <p className="mt-1 truncate text-sm text-[var(--ink-soft)]">
              {restaurantName || "Tu restaurante"}
              {role ? ` · ${roleLabel(role)}` : ""}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">{nav}</div>
          <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
            <ThemeToggle />
            <button type="button" onClick={signOut} className="btn-ghost flex-1">
              Salir
            </button>
          </div>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        {setupOnly ? (
          <div className="bg-[var(--chip-warn-bg)] px-4 py-3 text-center text-base text-[var(--chip-warn-fg)]">
            Todavía no puedes vender.{" "}
            <Link href="/pagos" className="font-bold underline">
              Elige un plan
            </Link>
            {" o "}
            <Link href="/empezar" className="font-bold underline">
              sigue los primeros pasos
            </Link>
            .
          </div>
        ) : null}

        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--ink-soft)] lg:hidden">
                {restaurantName || "Wapifood"}
                {role ? ` · ${roleLabel(role)}` : ""}
              </p>
              <h1 className="truncate text-[1.7rem] leading-tight sm:text-[2rem]">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {focus ? (
                <Link href={home} className="btn-ghost inline-flex items-center px-3 no-underline">
                  Inicio
                </Link>
              ) : null}
              <ThemeToggle />
              <button type="button" onClick={signOut} className="btn-ghost px-4 lg:hidden">
                Salir
              </button>
              {focus ? (
                <button type="button" onClick={signOut} className="btn-ghost hidden px-4 lg:inline-flex">
                  Salir
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <main className={`mx-auto max-w-[1440px] px-4 py-5 ${focus ? "pb-8" : "pb-28 lg:pb-10"}`}>{children}</main>
      </div>

      {focus ? null : (
        <nav className="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] px-1 py-1 lg:hidden" aria-label="Accesos rápidos">
          <div className="mx-auto flex max-w-3xl gap-1">
            {primary.map((m) => (
              <Link key={m.id} href={m.href} aria-current={current(m.href) ? "page" : undefined} className="tab-link">
                <Icon name={m.icon} size={22} />
                {m.title}
              </Link>
            ))}
            <button type="button" className="tab-link" onClick={() => setMore(true)} aria-expanded={more} aria-haspopup="dialog">
              <Icon name="list" size={22} />
              Más
            </button>
          </div>
        </nav>
      )}

      {more ? (
        <div className="sheet-back lg:hidden" onClick={() => setMore(false)} role="presentation">
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Todas las secciones"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl">Todas las secciones</h2>
              <button type="button" className="btn-ghost px-3" onClick={() => setMore(false)}>
                Cerrar
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}

      <HelpChat lift={focus ? "high" : ""} />
    </div>
  );
}
