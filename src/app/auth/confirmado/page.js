import Link from "next/link";

export const metadata = { title: "Correo confirmado · Wapifood" };

export default async function ConfirmadoPage({ searchParams }) {
  const params = await searchParams;
  const ok = (params?.status || "ok") !== "error";
  const message = params?.message || "";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-cream)] px-4">
      <div className="pointer-events-none absolute -left-16 top-16 h-48 w-48 rounded-full bg-[var(--color-ember)]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-10 h-56 w-56 rounded-full bg-[var(--color-sage)]/15 blur-3xl" />
      <section className="relative w-full max-w-lg rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-center shadow-sm">
        <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-2xl font-bold text-white ${ok ? "bg-[var(--color-sage)]" : "bg-[var(--color-wine)]"}`}>
          {ok ? "✓" : "!"}
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-ember)]">Wapifood</p>
        {ok ? (
          <>
            <h1 className="mt-2 text-4xl leading-tight">Tu correo ya está confirmado</h1>
            <p className="mt-3 text-[var(--color-muted)]">
              Gracias por confiar en nosotros. Tu cuenta quedó lista. Agradecemos tu preferencia.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)]">
                Iniciar sesión
              </Link>
              <Link href="/dashboard" className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] px-6 font-semibold">
                Ir al panel
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-4xl leading-tight">No pudimos confirmar el correo</h1>
            <p className="mt-3 text-[var(--color-muted)]">El enlace puede haber expirado o ya se usó.</p>
            {message ? <p className="mt-2 rounded-xl bg-[var(--color-cream)] px-3 py-2 text-sm text-[var(--color-wine)]">{message}</p> : null}
            <Link href="/login" className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-ink)] px-6 font-semibold text-[var(--color-cream)]">
              Volver al acceso
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
