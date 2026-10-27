"use client";

import Link from "next/link";
import { useState } from "react";

const PLANS = [
  {
    id: "ventas",
    title: "Plan Ventas",
    subtitle: "Perfecto para empezar",
    monthly: 400,
    yearly: 4000,
    popular: false,
    mesas: 3,
    meseros: 2,
    features: [
      "Punto de venta completo",
      "Dashboard y reportes",
      "Menú digital con QR",
      "Tickets digitales",
      "App móvil (APK)",
      "Gestión de cocina",
      "Control de inventario",
      "Hasta 2 meseros",
    ],
  },
  {
    id: "restaurante",
    title: "Plan Restaurante",
    subtitle: "Ideal para restaurantes",
    monthly: 600,
    yearly: 6000,
    popular: true,
    mesas: 15,
    meseros: 5,
    features: [
      "Todo lo del Plan Ventas",
      "Más mesas y meseros",
      "Menú digital con QR",
      "Tickets digitales",
      "App móvil (APK)",
      "Cocina en tiempo real",
      "Inventario y recetas",
      "Hasta 5 meseros",
    ],
  },
  {
    id: "plus",
    title: "Plan Restaurante Plus",
    subtitle: "Para operación intensa",
    monthly: 800,
    yearly: 8000,
    popular: false,
    mesas: 25,
    meseros: 10,
    features: [
      "Todo lo del Plan Restaurante",
      "Hasta 25 mesas",
      "Hasta 10 meseros",
      "Prioridad en soporte",
      "Menú digital y kiosko",
      "Inventario avanzado",
      "Reportes ampliados",
      "Listo para crecer",
    ],
  },
];

const money = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

export function PricingSection() {
  const [billing, setBilling] = useState("mensual");

  return (
    <section id="precios" className="border-t border-[var(--color-line)] bg-[var(--color-paper)] py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-ember)]">
            Precios claros
          </p>
          <h2 className="mt-2 text-4xl">Elige el plan de tu restaurante</h2>
          <p className="mt-3 text-[var(--color-muted)]">
            Mismos paquetes que en Wapifood original. Sin sorpresas: mesas, meseros y
            módulos incluidos según el plan.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] p-1">
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
          {PLANS.map((plan) => {
            const price = billing === "mensual" ? plan.monthly : plan.yearly;
            const period = billing === "mensual" ? "mxn / mes" : "mxn / año";
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-[1.75rem] border p-6 ${
                  plan.popular
                    ? "border-[var(--color-ember)] bg-[var(--color-cream)] shadow-sm"
                    : "border-[var(--color-line)] bg-[var(--color-cream)]/40"
                }`}
              >
                {plan.popular ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-[var(--color-ember)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Más popular
                  </span>
                ) : null}
                <h3 className="text-2xl">{plan.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{plan.subtitle}</p>
                <p className="mt-5">
                  <span className="text-4xl font-semibold tracking-tight">{money(price)}</span>
                  <span className="ml-2 text-sm text-[var(--color-muted)]">{period}</span>
                </p>
                <div className="mt-4 flex gap-3 text-sm">
                  <span className="rounded-full bg-[var(--color-paper)] px-3 py-1 font-semibold">
                    {plan.mesas} mesas
                  </span>
                  <span className="rounded-full bg-[var(--color-paper)] px-3 py-1 font-semibold">
                    {plan.meseros} meseros
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
                  className={`mt-6 inline-flex h-12 items-center justify-center rounded-full text-sm font-semibold ${
                    plan.popular
                      ? "bg-[var(--color-ember)] text-white"
                      : "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  }`}
                >
                  Empezar con {plan.title.replace("Plan ", "")}
                </Link>
              </article>
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
