import Link from "next/link";

const features = [
  { t: "Punto de venta", d: "Mesas, cuentas, cobro y ticket en un solo flujo." },
  { t: "Cocina en vivo", d: "Comandas claras para el pase de cocina." },
  { t: "Insumos y recetas", d: "El stock baja al cobrar, sin microservicio aparte." },
  { t: "Menú digital", d: "QR, kiosko y pedido del comensal." },
  { t: "Meseros", d: "Códigos de acceso y asignación a mesas." },
  { t: "Multi-sucursal listo", d: "Cada restaurante aislado con RLS en Supabase." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <p className="text-xl font-semibold tracking-tight">Wapifood</p>
        <div className="flex gap-2">
          <Link href="/login" className="h-11 rounded-full border border-[var(--color-line)] px-4 text-sm font-semibold leading-[2.75rem]">
            Entrar
          </Link>
          <Link href="/login" className="h-11 rounded-full bg-[var(--color-ink)] px-4 text-sm font-semibold leading-[2.75rem] text-[var(--color-cream)]">
            Probar demo
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-ember)]">
            Software de restaurante
          </p>
          <h1 className="mt-3 text-5xl leading-[1.05] sm:text-6xl">
            Opera el piso sin caos ni sistemas sueltos
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--color-muted)]">
            Wapifood junta punto de venta, cocina, menú cliente, meseros e inventario
            en una sola app. Migrado desde Comanadas a una base moderna y segura.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex h-12 items-center rounded-full bg-[var(--color-ember)] px-6 font-semibold text-white">
              Iniciar sesión
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
            Misma lógica de negocio del sistema anterior, ahora con Supabase,
            roles y cobro atómico de inventario.
          </p>
        </div>
      </section>

      <section id="modulos" className="border-t border-[var(--color-line)] bg-[var(--color-paper)] py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl">Todo lo que ya hacía Comanadas</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.t} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-cream)] p-5">
                <h3 className="text-xl">{f.t}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-[var(--color-muted)]">
        Wapifood · operación de restaurante
      </footer>
    </div>
  );
}
