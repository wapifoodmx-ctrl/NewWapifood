"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { PricingSection } from "@/components/PricingSection";
import ThemeToggle from "@/components/ThemeToggle";
import { Icon } from "@/components/ui/Icon";
import SplitText from "@/components/SplitText";
import RotatingText from "@/components/RotatingText";
import { OriginButton } from "@/components/OriginButton";

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
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          <p className="brand text-3xl">Wapifood</p>
          <RotatingText texts={["Fácil", "Restaurantes", "Negocios", "Emprende", "Te ayuda"]} mainClassName="text-3xl" />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <OriginButton className="btn btn-ghost hidden items-center justify-center px-4 no-underline sm:inline-flex" onClick={() => document.getElementById("precios")?.scrollIntoView({ behavior: "smooth" })}>
            Precios
          </OriginButton>
          <OriginButton
            className="btn btn-ghost hidden items-center justify-center px-4 no-underline sm:inline-flex"
            onClick={() => router.push("/login")}
          >
            Entrar
          </OriginButton>
          <OriginButton className="btn btn-primary" onClick={() => router.push("/login")}>
            Crear cuenta
          </OriginButton>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-base font-bold text-[var(--primary)]">Para restaurantes, fondas y cafeterías</p>
          <SplitText
            tag="h1"
            text="Caja, cocina y menú. Tan claro que cualquiera lo usa."
            className="mt-2 text-5xl leading-[1.05] sm:text-6xl"
            effect="blur"
            splitType="words"
            textAlign="left"
          />
          <p className="mt-4 max-w-xl text-xl text-[var(--ink-soft)]">
            Wapifood es el sistema de tu restaurante: vender, ver las mesas, pasar comandas y controlar lo que hay en bodega. Sin instalar nada raro.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <OriginButton className="btn-lg btn-primary w-full items-center justify-center sm:w-auto" onClick={() => router.push("/login")}>
              Empezar ahora
            </OriginButton>
            <OriginButton className="btn-lg btn-ghost w-full items-center justify-center sm:w-auto" onClick={() => document.getElementById("precios")?.scrollIntoView({ behavior: "smooth" })}>
              Ver precios
            </OriginButton>
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
          <SplitText tag="h2" text="Cómo se empieza" className="text-4xl" effect="blur" />
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
          <SplitText tag="h2" text="Todo el piso, en un solo lugar" className="text-4xl" effect="blur" />
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
