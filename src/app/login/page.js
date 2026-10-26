import { AppShell } from "@/components/AppShell";

export default function LoginPage() {
  return (
    <AppShell title="Acceso">
      <section className="mx-auto max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
        <h2 className="text-2xl">Entrar al restaurante</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          El siguiente patch conectará Supabase Auth (email/contraseña). Mientras,
          crea el usuario en el panel de Supabase y enlázalo con{" "}
          <code className="rounded bg-[var(--color-cream)] px-1">003_bootstrap_owner.sql</code>.
        </p>
      </section>
    </AppShell>
  );
}
