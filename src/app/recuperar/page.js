"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const supabase = createClient();
    try {
      const origin = window.location.origin;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/actualizar-password`,
      });
      if (err) throw err;
      setInfo("Si el correo existe, te enviamos un enlace para restablecer la contraseña.");
    } catch (err) {
      setError(err.message || "No se pudo enviar el correo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-ember)]">Wapifood</p>
        <h1 className="mt-2 text-3xl">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Te enviaremos un correo con un enlace seguro para elegir una nueva contraseña.
        </p>
        <label className="mt-6 block text-sm font-semibold">
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-[var(--color-wine)]">{error}</p> : null}
        {info ? <p className="mt-3 rounded-xl bg-[var(--color-cream)] px-3 py-2 text-sm text-[var(--color-sage)]">{info}</p> : null}
        <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)] disabled:opacity-60">
          {loading ? "Enviando…" : "Enviar enlace"}
        </button>
        <Link href="/login" className="mt-4 block text-center text-sm font-semibold text-[var(--color-muted)]">
          Volver al login
        </Link>
      </form>
    </div>
  );
}
