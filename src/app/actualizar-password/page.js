"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ActualizarPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Mínimo 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "No se pudo actualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-ember)]">Wapifood</p>
        <h1 className="mt-2 text-3xl">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Elige una contraseña nueva para tu cuenta.</p>
        <label className="mt-6 block text-sm font-semibold">
          Contraseña nueva
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3" />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Confirmar contraseña
          <input type="password" required minLength={6} value={password2} onChange={(e) => setPassword2(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3" />
        </label>
        {error ? <p className="mt-3 text-sm text-[var(--color-wine)]">{error}</p> : null}
        <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)] disabled:opacity-60">
          {loading ? "Guardando…" : "Guardar y entrar"}
        </button>
        <Link href="/login" className="mt-4 block text-center text-sm text-[var(--color-muted)]">Volver al login</Link>
      </form>
    </div>
  );
}
