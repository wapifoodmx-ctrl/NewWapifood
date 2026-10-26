import Link from "next/link";
import { MODULES } from "@/lib/modules";

export function AppShell({ children, title = "Wapifood" }) {
  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Wapifood SaaS
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl leading-none">
              {title}
            </h1>
          </div>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] px-4 text-sm font-semibold"
          >
            Entrar
          </Link>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-3">
          {MODULES.filter((m) => m.href !== "#").map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className="flex h-10 shrink-0 items-center rounded-full bg-[var(--color-cream)] px-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)]"
            >
              {m.title}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
