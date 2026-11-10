"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { PLANS, moneyMX } from "@/lib/plans";
import SplitText from "@/components/SplitText";
import PixelCard from "@/components/PixelCard";

export function PricingSection() {
  const [billing, setBilling] = useState("mensual");
  const [mode, setMode] = useState("single");
  const appTheme = useSyncExternalStore(
    (cb) => {
      window.addEventListener("themechange", cb);
      return () => window.removeEventListener("themechange", cb);
    },
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light"
  );
  const visiblePlans = PLANS.filter((p) => (mode === "multi") === !!p.multi);

  return (
    <section id="precios" className="border-t border-[var(--color-line)] bg-[var(--color-paper)] py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-ember)]">
            Precios claros
          </p>
          <SplitText tag="h2" text="Elige el plan de tu restaurante" className="mt-2 text-4xl" effect="blur" />
          <p className="mt-3 text-[var(--color-muted)]">
            Sin sorpresas. El anual paga 10 meses. Si tienes varios locales, el precio es el total del grupo: cada local conserva sus mesas y meseros.
          </p>

          {/* Modo: un local vs varios locales */}
          <div className="mt-6 inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] p-1">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`h-10 rounded-full px-5 text-sm font-semibold ${
                mode === "single"
                  ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Un solo local
            </button>
            <button
              type="button"
              onClick={() => setMode("multi")}
              className={`h-10 rounded-full px-5 text-sm font-semibold ${
                mode === "multi"
                  ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Varios locales
            </button>
          </div>

          {/* Facturación */}
          <div className="mt-3 inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] p-1">
            <button
              type="button"
              onClick={() => setBilling("mensual")}
              className={`h-10 rounded-full px-5 text-sm font-semibold ${
                billing === "mensual"
                  ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBilling("anual")}
              className={`h-10 rounded-full px-5 text-sm font-semibold ${
                billing === "anual"
                  ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Anual · 2 meses gratis
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {visiblePlans.map((plan) => {
            const price = billing === "mensual" ? plan.monthly : plan.yearly;
            const period = billing === "mensual" ? "mxn / mes" : "mxn / año";
            const body = (
              <>
                {plan.popular ? (
                  <span className="mb-3 block w-fit rounded-full bg-[var(--color-ember)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Más popular
                  </span>
                ) : null}
                <SplitText
                  tag="h3"
                  text={plan.title}
                  className="text-2xl"
                  effect="blur"
                  duration={1}
                  delay={25}
                  textAlign="left"
                />
                <p className="mt-1 text-sm text-[var(--color-muted)]">{plan.subtitle}</p>
                {plan.multi ? (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ember)]">
                    Hasta {plan.restaurants} restaurantes · precio total
                  </p>
                ) : null}
                <p className="mt-5">
                  <span className="text-4xl font-semibold tracking-tight">{moneyMX(price)}</span>
                  <span className="ml-2 text-sm text-[var(--color-muted)]">{period}</span>
                </p>
                <div className="mt-4 flex gap-3 text-sm">
                  <span className="rounded-full bg-[var(--color-paper)] px-3 py-1 font-semibold">
                    {plan.mesas} mesas{plan.multi ? " por local" : ""}
                  </span>
                  <span className="rounded-full bg-[var(--color-paper)] px-3 py-1 font-semibold">
                    {plan.meseros} meseros{plan.multi ? " por local" : ""}
                  </span>
                </div>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-[var(--color-muted)]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-0.5 text-[var(--color-sage)]">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold ${
                    plan.popular
                      ? "bg-[var(--color-ember)] text-white"
                      : "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  }`}
                >
                  Empezar con {plan.title.replace("Plan ", "")}
                </Link>
              </>
            );
            return (
              <PixelCard
                key={plan.id}
                theme={appTheme}
                radius={28}
                opacity={0.28}
                fade={0.65}
                spotlight={0.45}
                glow={0.35}
                className="flex flex-col"
                style={{ width: "100%", height: "auto", minHeight: "440px", display: "block", padding: "1.5rem" }}
              >
                {body}
              </PixelCard>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
          Precios en pesos mexicanos. La pasarela de pago se conecta en el módulo de
          suscripción del panel.
        </p>
      </div>
    </section>
  );
}
