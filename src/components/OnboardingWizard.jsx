"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const SKIP_KEY = "wapifood-onboarding-skip";

export function OnboardingWizard({ steps, canSell }) {
  const [skipped, setSkipped] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const kick = setTimeout(() => {
      try {
        const raw = JSON.parse(localStorage.getItem(SKIP_KEY) || "[]");
        if (Array.isArray(raw)) setSkipped(raw.filter((id) => typeof id === "string"));
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(kick);
  }, []);

  function skip(id) {
    const next = [...new Set([...skipped, id])];
    setSkipped(next);
    try {
      localStorage.setItem(SKIP_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const doneCount = steps.filter((step) => step.ok).length;
  const current = steps.find((step) => !step.ok && !skipped.includes(step.id));
  const finished = !current;

  return (
    <div>
      <p className="text-lg text-[var(--ink-soft)]">
        Cuatro pasos para tu primera venta. Puedes saltar cualquiera y volver después.
      </p>
      <div className="stepper mt-4" aria-hidden="true">
        {steps.map((step) => (
          <span key={step.id} className={`step-pip ${step.ok ? "done" : current?.id === step.id ? "now" : ""}`} />
        ))}
      </div>
      <p className="mb-4 text-base font-bold">
        Vas en {Math.min(doneCount + 1, steps.length)} de {steps.length}. Completaste {doneCount}.
      </p>

      {finished ? (
        <section className="card p-6">
          <p className="text-sm font-bold text-[var(--sage)]">Listo para vender</p>
          <h2 className="mt-1 text-3xl">Ya puedes hacer una venta</h2>
          <p className="mt-2 text-lg text-[var(--ink-soft)]">
            {canSell
              ? "Abre la caja, toca un platillo y cobra. Si fue de prueba, puedes cancelar la cuenta."
              : "Para cobrar hace falta un plan activo. Puedes ver los planes o seguir armando la carta."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={canSell ? "/pos" : "/pagos"} className="btn-lg btn-primary inline-flex items-center px-5 no-underline">
              {canSell ? "Ir a la caja" : "Ver planes"}
            </Link>
            <Link href="/carta" className="btn-ghost inline-flex items-center px-4 no-underline">
              Revisar platillos
            </Link>
          </div>
        </section>
      ) : (
        <section className="card p-6">
          <p className="text-base font-bold text-[var(--primary)]">Paso {steps.findIndex((s) => s.id === current.id) + 1}</p>
          <h2 className="mt-1 text-3xl">{current.title}</h2>
          <p className="mt-2 text-lg text-[var(--ink-soft)]">{current.detail}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={current.href} className="btn-lg btn-primary inline-flex items-center px-5 no-underline">
              {current.action}
            </Link>
            <button type="button" className="btn-ghost px-4" onClick={() => skip(current.id)}>
              Saltar este paso
            </button>
          </div>
        </section>
      )}

      <button type="button" className="btn-ghost mt-4 px-4" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
        {showAll ? "Ocultar la lista" : "Ver todos los pasos"}
      </button>
      {showAll ? (
        <ol className="mt-3 space-y-2">
          {steps.map((step, index) => (
            <li key={step.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-full ${step.ok ? "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-fg)]" : "bg-[var(--surface-2)]"}`}>
                  {step.ok ? <Icon name="check" size={20} /> : index + 1}
                </span>
                <div>
                  <p className="text-lg font-extrabold">{step.title}</p>
                  <p className="text-base text-[var(--ink-soft)]">{step.ok ? "Hecho" : skipped.includes(step.id) ? "Saltado" : "Pendiente"}</p>
                </div>
              </div>
              {step.ok ? null : (
                <Link href={step.href} className="btn-ghost inline-flex items-center justify-center px-4 no-underline">
                  {step.action}
                </Link>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      <p className="mt-6 text-base text-[var(--ink-soft)]">
        ¿Quieres entrar directo?{" "}
        <Link href={canSell ? "/pos" : "/pagos"} className="font-bold text-[var(--primary)] underline">
          {canSell ? "Abrir la caja" : "Ver cómo activar el plan"}
        </Link>
      </p>
    </div>
  );
}
