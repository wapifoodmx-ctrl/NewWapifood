"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, homePath, modulesInGroup, roleLabel, sectionForPath } from "@/lib/modules";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { RestaurantSwitcher } from "@/components/RestaurantSwitcher";
import { HelpChat } from "@/components/HelpChat";
import { Icon } from "@/components/ui/Icon";
import { CommandPalette } from "@/components/CommandPalette";
import { SideNav, useNavPrefs } from "@/components/SideNav";
import { OriginButton } from "@/components/OriginButton";
import { TourGuide, startTour } from "@/components/tours/TourGuide";

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
  const [sheetGroup, setSheetGroup] = useState(null);
  const [palette, setPalette] = useState(false);
  const { rail, open, toggleRail, toggleSection, ensureSection } = useNavPrefs();
  const home = homePath(role);
  const sheetItems = sheetGroup ? modulesInGroup(role, sheetGroup) : [];
  const sheetTitle = NAV_GROUPS.find((group) => group.id === sheetGroup)?.label || "Todas las secciones";

  useEffect(() => {
    ensureSection(sectionForPath(role, pathname));
  }, [pathname, role, ensureSection]);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("accept_team_invites").then(({ data }) => {
      if (Number(data) > 0) router.refresh();
    });
  }, [router]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function current(href) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  function openSearch() {
    setMore(false);
    setPalette(true);
  }

  return (
    <div className={`app-frame min-h-screen bg-[var(--bg)] text-[var(--ink)] ${focus ? "focus" : "lg:flex"}`}>
      {focus ? null : (
        <aside data-tour="menu" className={`app-side hidden lg:flex lg:flex-col ${rail ? "is-rail" : ""}`} aria-label="Navegación">
          <SideNav
            role={role}
            restaurantName={restaurantName}
            pathname={pathname}
            rail={rail}
            openSections={open}
            onToggleRail={toggleRail}
            onToggleSection={toggleSection}
            onSearch={openSearch}
            onSignOut={signOut}
            homeHref={home}
          />
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

        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="min-w-0">
              <p data-tour="local" className="truncate text-sm text-[var(--ink-soft)] lg:hidden">
                {restaurantName || "Wapifood"}
                {role ? ` · ${roleLabel(role)}` : ""}
              </p>
              <h1 className="truncate text-[1.7rem] leading-tight sm:text-[2rem]">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="lg:hidden">
                <RestaurantSwitcher />
              </div>
              <button type="button" data-tour="buscar" className="icon-btn" onClick={openSearch} aria-label="Buscar pantalla" aria-keyshortcuts="Control+K">
                <Icon name="search" size={24} />
              </button>
              {focus ? (
                <button
                  type="button"
                  className="icon-btn lg:hidden"
                  aria-label="Abrir el menú"
                  aria-expanded={more}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setSheetGroup(null);
                    setMore(true);
                  }}
                >
                  <Icon name="list" size={24} />
                </button>
              ) : null}
              {focus ? (
                <div className="hidden lg:block">
                  <OriginButton className="btn-ghost" onClick={() => router.push(home)}>
                    Inicio
                  </OriginButton>
                </div>
              ) : null}
              <ThemeToggle className={focus ? "" : "lg:hidden"} />
              <button type="button" className="btn-ghost hidden h-12 px-3 sm:inline-flex" onClick={() => startTour(undefined, { force: true })}>
                Ver guía
              </button>
              {focus ? (
                <div className="hidden lg:block">
                  <OriginButton className="btn-ghost" onClick={signOut}>
                    Salir
                  </OriginButton>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className={`mx-auto max-w-[1440px] px-4 py-5 ${focus ? "pb-8" : "pb-28 lg:pb-10"}`}>{children}</main>
        <TourGuide role={role} />
      </div>

      {focus ? null : (
        <nav data-tour="menu" className="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] px-1 py-1 lg:hidden" aria-label="Accesos rápidos">
          <div className="mx-auto flex max-w-3xl gap-1">
            {NAV_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                className="tab-link"
                aria-current={modulesInGroup(role, group.id).some((item) => current(item.href)) ? "page" : undefined}
                aria-expanded={more && sheetGroup === group.id}
                aria-haspopup="dialog"
                onClick={() => {
                  setSheetGroup(group.id);
                  setMore(true);
                }}
              >
                <Icon name={group.icon} size={24} />
                <span>{group.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="tab-link"
              onClick={() => {
                setSheetGroup(null);
                setMore(true);
              }}
              aria-expanded={more && !sheetGroup}
              aria-haspopup="dialog"
            >
              <Icon name="list" size={24} />
              <span>Más</span>
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
            aria-label={sheetTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl">{sheetTitle}</h2>
              <button type="button" className="btn-ghost px-3" onClick={() => setMore(false)}>
                Cerrar
              </button>
            </div>
            {sheetGroup ? (
              <div className="grid gap-2">
                {sheetItems.map((item) => (
                  <Link key={item.id} href={item.href} className="tab-sheet-link" aria-current={current(item.href) ? "page" : undefined} onClick={() => setMore(false)}>
                    <Icon name={item.icon} size={28} />
                    <span>
                      {item.title}
                      <small>{item.hint}</small>
                    </span>
                  </Link>
                ))}
                {sheetItems.length ? null : (
                  <p className="text-lg text-[var(--ink-soft)]">En este acceso no hay pantallas para tu puesto. Ábrelas en Más.</p>
                )}
              </div>
            ) : (
            <SideNav
              variant="sheet"
              role={role}
              restaurantName={restaurantName}
              pathname={pathname}
              openSections={open}
              onToggleSection={toggleSection}
              onSearch={openSearch}
              onSignOut={signOut}
              onNavigate={() => setMore(false)}
              homeHref={home}
            />
            )}
          </div>
        </div>
      ) : null}

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <HelpChat lift={focus ? "high" : ""} />
    </div>
  );
}
