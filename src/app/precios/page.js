import Link from "next/link";
import { PricingSection } from "@/components/PricingSection";
import ThemeToggle from "@/components/ThemeToggle";

const faqs = [
  ["¿El anual sale más barato?", "Sí. Pagas 10 meses y usas el plan 12. Cada tarjeta dice cuánto ahorras."],
  ["¿Varios locales se cobran aparte?", "No. Brasas, Comales y Fogones tienen un precio total del grupo. Cada local conserva sus mesas y meseros."],
  ["¿Puedo subir o bajar de plan?", "Sí. El pago nuevo deja el plan anterior como reemplazado. No se borran mesas, meseros ni locales."],
  ["¿Hay prueba?", "Una cuenta nueva tiene 14 días en Brasa, sin cobro."],
];

export default function PreciosPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="entry flex items-center justify-between gap-3 py-5">
        <Link href="/" className="brand text-3xl no-underline">Wapifood</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn btn-primary inline-flex items-center justify-center no-underline">Crear cuenta</Link>
        </div>
      </header>
      <div id="contenido">
        <PricingSection />
      </div>
      <section className="faq-band mx-auto max-w-3xl px-4">
        <h2 className="text-3xl">Preguntas frecuentes</h2>
        <div className="mt-4">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p className="mt-2 text-lg text-[var(--ink-soft)]">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
