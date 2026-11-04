import Link from "next/link";
import { PricingSection } from "@/components/PricingSection";
import ThemeToggle from "@/components/ThemeToggle";
import { Icon } from "@/components/ui/Icon";

const features = [
  { icon: "register", t: "Caja", d: "Mesas, cuenta, cobro y ticket. Tres toques para cobrar." },
  { icon: "flame", t: "Cocina", d: "Comandas grandes, con el tiempo que llevan esperando." },
  { icon: "box", t: "Insumos y recetas", d: "El stock baja al cobrar, sin sistemas sueltos." },
  { icon: "qr", t: "Menú para llevar", d: "QR, kiosko y pedido del comensal, con foto." },
  { icon: "users", t: "Meseros", d: "Entran con un código y solo ven sus mesas." },
  { icon: "home", t: "Cómo va el día", d: "Ventas, mesas ocupadas y lo que se está acabando." },
];

const steps = [
  { n: "1", t: "Crea tu cuenta", d: "Con tu correo. Te llega un enlace para confirmar." },
  { n: "2", t: "Arma la carta", d: "Platillos, una mesa y los datos del local." },
  { n: "3", t: "Cobra la primera", d: "Elige un plan y vende en efectivo, tarjeta o Mercado Pago." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <p className="brand text-3xl">Wapifood</p>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a href="#precios" className="btn-ghost hidden px-4 no-underline sm:inline-flex">
            Precios
          </a>
          <Link href="/login" className="btn-ghost hidden px-4 no-underline sm:inline-flex">
            Entrar
          </Link>
          <Link href="/login" className="btn-primary inline-flex items-center px-4 no-underline">
            Crear cuenta
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-base font-bold text-[var(--primary)]">Para restaurantes, fondas y cafeterías</p>
          <h1 className="mt-2 text-5xl leading-[1.05] sm:text-6xl">
            Caja, cocina y menú. Tan claro que cualquiera lo usa.
          </h1>
          <p className="mt-4 max-w-xl text-xl text-[var(--ink-soft)]">
            Wapifood es el sistema de tu restaurante: vender, ver las mesas, pasar comandas y controlar lo que hay en bodega. Sin instalar nada raro.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="btn-lg btn-primary inline-flex items-center px-6 no-underline">
              Empezar ahora
            </Link>
            <a href="#precios" className="btn-lg btn-ghost inline-flex items-center px-6 no-underline">
              Ver precios
            </a>
          </div>
        </div>
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-3">
            {features.slice(0, 4).map((f) => (
              <div key={f.t} className="rounded-2xl bg-[var(--surface-2)] p-4">
                <span className="role-ico">
                  <Icon name={f.icon} size={26} />
                </span>
                <p className="mt-3 text-2xl font-extrabold">{f.t}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-base text-[var(--ink-soft)]">
            Del primer pedido al cobro, con el stock incluido.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)] py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-4xl">Cómo se empieza</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <article key={s.n} className="rounded-3xl bg-[var(--bg)] p-5">
                <p className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary-solid)] text-xl font-extrabold text-[var(--on-solid)]">{s.n}</p>
                <h3 className="mt-3 text-2xl">{s.t}</h3>
                <p className="mt-2 text-lg text-[var(--ink-soft)]">{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modulos" className="py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-4xl">Todo el piso, en un solo lugar</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.t} className="card p-5">
                <span className="role-ico">
                  <Icon name={f.icon} size={26} />
                </span>
                <h3 className="mt-3 text-2xl">{f.t}</h3>
                <p className="mt-2 text-lg text-[var(--ink-soft)]">{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-base text-[var(--ink-soft)]">
        <p>Wapifood · el sistema de tu restaurante</p>
        <Link href="/terminos" className="font-bold underline">
          Términos
        </Link>
      </footer>
    </div>
  );
}
