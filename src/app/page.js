import Link from "next/link";
import { PricingSection } from "@/components/PricingSection";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  { t: "Punto de venta", d: "Tocas el producto y cobras. El mostrador ya está abierto." },
  { t: "Cocina", d: "Comandas grandes, con el tiempo que llevan esperando." },
  { t: "Insumos y recetas", d: "El stock baja al cobrar, sin sistemas sueltos." },
  { t: "Menú para llevar", d: "QR, kiosko y pedido del comensal, con foto." },
  { t: "Meseros", d: "Entran con un código y solo ven sus mesas." },
  { t: "Cómo va el día", d: "Ventas, mesas ocupadas y lo que se está acabando." },
];

const steps = [
  { t: "Crea tu cuenta", d: "Con tu correo. Te llega un enlace para confirmar." },
  { t: "Carga tus productos", d: "Categoría, precio y, si quieres, foto. Es la carta de siempre." },
  { t: "Cobra en punto de venta", d: "Activa el plan y vende en efectivo, tarjeta u otro tipo de pago." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="entry flex items-center justify-between gap-3 py-5">
        <p className="brand text-3xl">Wapifood</p>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/precios" className="btn btn-ghost hidden items-center justify-center no-underline sm:inline-flex">
            Precios
          </Link>
          <Link href="/login" className="btn btn-ghost hidden items-center justify-center no-underline sm:inline-flex">
            Entrar
          </Link>
          <Link href="/login" className="btn btn-primary inline-flex items-center justify-center no-underline">
            Crear cuenta
          </Link>
        </div>
      </header>

      <section id="contenido" className="entry hero-band">
        <div>
          <h1>Punto de venta, cocina y menú.</h1>
          <p className="mt-4 max-w-xl text-xl text-[var(--ink-soft)]">
            Vendes, pasas la comanda y ves qué queda en bodega, como ya lo usabas.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-lg btn-primary inline-flex items-center justify-center no-underline">
              Empezar ahora
            </Link>
            <a href="#precios" className="btn btn-lg btn-ghost inline-flex items-center justify-center no-underline">
              Ver precios
            </a>
          </div>
        </div>
        <article className="ticket" aria-label="Cuenta de mostrador">
          <p className="ticket-place">Mostrador</p>
          <p className="ticket-state">Abierto</p>
          <ol>
            <li>2 tacos, sin cebolla</li>
            <li>1 agua</li>
          </ol>
          <p className="ticket-action">Cobrar</p>
        </article>
      </section>

      <section className="entry start-band">
        <h2 className="text-4xl">Cómo se empieza</h2>
        <ol className="start-list">
          {steps.map((step, index) => (
            <li key={step.t}>
              <h3>{index + 1}. {step.t}</h3>
              <p>{step.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="modulos" className="entry floor-band">
        <h2 className="text-4xl">Todo el piso, en un solo lugar</h2>
        <p className="floor-lead max-w-2xl">
          Para restaurantes, fondas y cafeterías. Del primer pedido al cobro, con el stock incluido. Sin instalar nada raro.
        </p>
        <ul className="floor-list">
          {features.map((feature) => (
            <li key={feature.t}>
              <h3>{feature.t}</h3>
              <p>{feature.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <PricingSection />

      <section className="entry faq-band">
        <h2 className="text-4xl">Preguntas frecuentes</h2>
        <div className="mt-6">
          {[
            ["¿El anual sale más barato?", "Sí. Pagas 10 meses y usas el plan 12. En cada tarjeta se ve cuánto ahorras."],
            ["¿Varios locales se cobran aparte?", "No. El precio de Brasas, Comales o Fogones es el total del grupo. Cada local conserva sus mesas y meseros."],
            ["¿Puedo bajar de plan?", "Sí. No se borran mesas, meseros ni locales. Si ya hay más de los que permite el plan nuevo, no se pueden dar de alta más hasta quitar los que sobran."],
            ["¿Hay prueba?", "Puedes armar productos, mesas y tu perfil antes de pagar. Para cobrar en el punto de venta se elige un plan, igual que antes."],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p className="mt-2 text-lg text-[var(--ink-soft)]">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="entry flex flex-wrap items-center justify-between gap-3 py-8 text-base text-[var(--ink-soft)]">
        <p>Wapifood. El sistema de tu restaurante.</p>
        <Link href="/terminos" className="font-bold underline">
          Términos
        </Link>
      </footer>
    </div>
  );
}
