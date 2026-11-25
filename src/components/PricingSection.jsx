"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS, moneyMX } from "@/lib/plans";

export function PricingSection({ onChoose, busy = false }) {
  const [billing, setBilling] = useState("mensual");
  const [mode, setMode] = useState("single");
  const visiblePlans = PLANS.filter((p) => (mode === "multi") === !!p.multi);

  return (
    <section id="precios" className="border-t border-[var(--border)] bg-[var(--surface)] py-14">
      <div className="entry">
        <h2 className="text-4xl">Elige el plan de tu restaurante</h2>
        <p className="mt-3 max-w-2xl text-lg text-[var(--ink-soft)]">
          Sin sorpresas. El anual paga 10 meses. Si tienes varios locales, el precio es el total del grupo: cada local conserva sus mesas y meseros.
        </p>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Un local o varios">
          <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")} className={mode === "single" ? "btn btn-primary" : "btn btn-ghost"}>
            Un solo local
          </button>
          <button type="button" aria-pressed={mode === "multi"} onClick={() => setMode("multi")} className={mode === "multi" ? "btn btn-primary" : "btn btn-ghost"}>
            Varios locales
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Mensual o anual">
          <button type="button" aria-pressed={billing === "mensual"} onClick={() => setBilling("mensual")} className={billing === "mensual" ? "btn btn-primary" : "btn btn-ghost"}>
            Mensual
          </button>
          <button type="button" aria-pressed={billing === "anual"} onClick={() => setBilling("anual")} className={billing === "anual" ? "btn btn-primary" : "btn btn-ghost"}>
            Anual, 2 meses gratis
          </button>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {visiblePlans.map((plan) => {
            const price = billing === "mensual" ? plan.monthly : plan.yearly;
            const period = billing === "mensual" ? "mxn / mes" : "mxn / año";
            const chooseClass = `btn mt-6 inline-flex w-full items-center justify-center no-underline ${plan.popular ? "btn-primary" : "btn-ghost"}`;
            return (
              <article key={plan.id} className="card flex flex-col p-6">
                <h3 className="text-2xl">{plan.title}</h3>
                {plan.popular ? <p className="chip chip-neutral mt-2 w-fit">Más popular</p> : null}
                <p className="mt-1 text-base text-[var(--ink-soft)]">{plan.subtitle}</p>
                {plan.multi ? (
                  <p className="mt-2 text-base text-[var(--ink-soft)]">
                    Hasta {plan.restaurants} restaurantes. El precio es el total.
                  </p>
                ) : null}
                <p className="mt-5">
                  <span className="price-figure">{moneyMX(price)}</span>
                  <span className="ml-2 text-base text-[var(--ink-soft)]">{period}</span>
                </p>
                <p className="mt-1 text-base font-bold text-[var(--sage)]">
                  {billing === "anual"
                    ? `Ahorras ${moneyMX(plan.monthly * 12 - plan.yearly)} frente a pagar mes a mes.`
                    : `El anual sale en ${moneyMX(plan.yearly)}: dos meses no se cobran.`}
                </p>
                <p className="mt-4 text-base font-bold">
                  {plan.mesas} mesas{plan.multi ? " por local" : ""}. {plan.meseros} meseros{plan.multi ? " por local" : ""}.
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-base text-[var(--ink-soft)]">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {onChoose ? (
                  <button type="button" disabled={busy} onClick={() => onChoose(plan, billing)} className={chooseClass}>
                    {busy ? "Redirigiendo…" : `Pagar ${plan.title}`}
                  </button>
                ) : (
                  <Link href="/login" className={chooseClass}>
                    Empezar con {plan.title}
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-base text-[var(--ink-soft)]">
          Precios en pesos mexicanos. La pasarela de pago se conecta en el módulo de suscripción del panel.
        </p>
      </div>
    </section>
  );
}
