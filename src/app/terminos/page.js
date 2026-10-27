import Link from "next/link";

export const metadata = { title: "Términos y condiciones · Wapifood" };

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[var(--color-cream)] px-4 py-10 text-[var(--color-ink)]">
      <article className="mx-auto max-w-2xl rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-ember)]">Wapifood</p>
        <h1 className="mt-2 text-4xl">Términos y condiciones</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--color-muted)]">
          <p>
            Al crear una cuenta en Wapifood aceptas usar el servicio de software para la operación de
            restaurantes (punto de venta, cocina, menú digital e inventario) conforme a estos términos.
          </p>
          <p>
            El titular de la cuenta es responsable de la información de su negocio, de los pedidos
            capturados y del cumplimiento de obligaciones fiscales y laborales de su establecimiento.
          </p>
          <p>
            Los planes tienen límites de mesas y meseros según el paquete contratado. El periodo de
            prueba y las renovaciones se gestionan desde el panel de pagos.
          </p>
          <p>
            Wapifood no intermediamos pagos de comensales salvo que se active una pasarela de cobro
            expresamente configurada. Los datos se almacenan en infraestructura en la nube con control
            de acceso por restaurante.
          </p>
          <p>
            Puedes solicitar la baja de tu cuenta contactando al soporte. El uso indebido del sistema
            puede implicar la suspensión del servicio.
          </p>
        </div>
        <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-[var(--color-ink)] px-5 text-sm font-semibold text-[var(--color-cream)]">
          Volver al inicio
        </Link>
      </article>
    </div>
  );
}
