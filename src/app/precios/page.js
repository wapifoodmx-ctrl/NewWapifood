"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PricingSection } from "@/components/PricingSection";
import ThemeToggle from "@/components/ThemeToggle";
import { OriginButton } from "@/components/OriginButton";

const faqs = [
  ["¿El anual sale más barato?", "Sí. Pagas 10 meses y usas el plan 12. Cada tarjeta dice cuánto ahorras."],
  ["¿Varios locales se cobran aparte?", "No. Brasas, Comales y Fogones tienen un precio total del grupo. Cada local conserva sus mesas y meseros."],
  ["¿Puedo subir o bajar de plan?", "Sí. El pago nuevo deja el plan anterior como reemplazado. No se borran mesas, meseros ni locales."],
  ["¿Hay prueba?", "Una cuenta nueva tiene 14 días en Brasa, sin cobro."],
];

export default function PreciosPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="brand text-3xl no-underline">Wapifood</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <OriginButton className="btn btn-primary" onClick={() => router.push("/login")}>Crear cuenta</OriginButton>
        </div>
      </header>
      <PricingSection />
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-3xl">Preguntas frecuentes</h2>
        <div className="mt-4 grid gap-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="rounded-2xl border border-[var(--border)] p-4">
              <summary className="cursor-pointer text-xl">{q}</summary>
              <p className="mt-2 text-lg text-[var(--ink-soft)]">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
