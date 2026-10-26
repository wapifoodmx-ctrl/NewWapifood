"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "No se pudo entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-ember)]">Wapifood</p>
        <h1 className="mt-2 text-3xl">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Acceso del dueño/admin. Los meseros usarán código desde el módulo Meseros.
        </p>

        <label className="mt-6 block text-sm font-semibold">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Contraseña
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-[var(--color-wine)]">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 h-12 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)] disabled:opacity-60"
        >
          {loading ? "Espera…" : mode === "login" ? "Entrar" : "Registrarme"}
        </button>

        <button
          type="button"
          className="mt-3 w-full text-sm font-semibold text-[var(--color-muted)]"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "¿Nueva cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
        </button>

        <Link href="/" className="mt-4 block text-center text-sm text-[var(--color-muted)]">
          Volver al inicio
        </Link>
      </form>
    </div>
  );
}
