import Link from "next/link";

const features = [
  { t: "Punto de venta", d: "Mesas, cuentas, cobro y ticket en un solo flujo." },
  { t: "Cocina en vivo", d: "Comandas claras para el pase de cocina." },
  { t: "Insumos y recetas", d: "El stock baja al cobrar, sin sistemas sueltos." },
  { t: "Menú digital", d: "QR, kiosko y pedido del comensal." },
  { t: "Meseros", d: "Códigos de acceso y control por mesa." },
  { t: "Panel y reportes", d: "Ventas del día, ocupación y alertas." },
];

const steps = [
  { n: "01", t: "Crea tu cuenta", d: "Regístrate con tu correo y confirma en un clic." },
  { n: "02", t: "Activa el plan", d: "Elige el plan que se ajuste a tu restaurante." },
  { n: "03", t: "Opera el piso", d: "POS, cocina, carta e inventario listos desde el día uno." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <p className="text-xl font-semibold tracking-tight">Wapifood</p>
        <div className="flex gap-2">
          <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-[var(--color-line)] px-4 text-sm font-semibold">
            Entrar
          </Link>
          <Link href="/login" className="inline-flex h-11 items-center rounded-full bg-[var(--color-ink)] px-4 text-sm font-semibold text-[var(--color-cream)]">
            Crear cuenta
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-ember)]">
            SaaS para restaurantes
          </p>
          <h1 className="mt-3 text-5xl leading-[1.05] sm:text-6xl">
            Menú digital, punto de venta y cocina en un solo lugar
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--color-muted)]">
            Wapifood es el software para operar tu restaurante: ventas, mesas,
            cocina, inventario y menú al cliente. Crea tu cuenta y empieza sin
            configurar bases de datos ni servidores.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex h-12 items-center rounded-full bg-[var(--color-ember)] px-6 font-semibold text-white">
              Empezar ahora
            </Link>
            <a href="#modulos" className="inline-flex h-12 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-6 font-semibold">
              Ver módulos
            </a>
          </div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            {["Mesas", "Cocina", "Carta", "Insumos"].map((x) => (
              <div key={x} className="rounded-2xl bg-[var(--color-cream)] p-4">
                <p className="text-sm text-[var(--color-muted)]">Módulo</p>
                <p className="text-2xl font-semibold">{x}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Basado en la operación real de Wapifood: del primer pedido al cobro,
            con control de stock incluido.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-paper)] py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl">Cómo funciona</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <article key={s.n} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-cream)] p-5">
                <p className="text-sm font-bold text-[var(--color-ember)]">{s.n}</p>
                <h3 className="mt-2 text-xl">{s.t}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modulos" className="py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl">Todo lo que necesitas en el piso</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.t} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
                <h3 className="text-xl">{f.t}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-ink)] py-14 text-[var(--color-cream)]">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl">Listo para tu restaurante</h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--color-cream)]/75">
            Crea tu cuenta en minutos. Nosotros preparamos tu espacio de trabajo
            automáticamente.
          </p>
          <Link href="/login" className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--color-ember)] px-6 font-semibold text-white">
            Crear mi cuenta
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--color-muted)]">
        Wapifood · software de operación para restaurantes
      </footer>
    </div>
  );
}
