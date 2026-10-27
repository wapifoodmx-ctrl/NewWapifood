"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // Onboarding automático del restaurante
        await supabase.rpc("create_my_restaurant", {
          p_name: restaurantName || "Mi restaurante",
        });
        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      }

      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/auth/confirmado`,
          data: {
            restaurant_name: restaurantName || "Mi restaurante",
          },
        },
      });
      if (err) throw err;

      if (!data.session) {
        setInfo(
          "Te enviamos un correo para confirmar tu cuenta. Ábrelo y sigue el enlace. Después podrás iniciar sesión.",
        );
        return;
      }

      await supabase.rpc("create_my_restaurant", {
        p_name: restaurantName || "Mi restaurante",
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "No se pudo completar la acción");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-cream)] px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-ember)]">Wapifood</p>
        <h1 className="mt-2 text-3xl">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          SaaS para restaurantes: crea tu cuenta, confirma tu correo y empieza a operar.
        </p>

        {mode === "signup" ? (
          <label className="mt-6 block text-sm font-semibold">
            Nombre del restaurante
            <input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Ej. Taquería El Patio"
              className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
            />
          </label>
        ) : null}

        <label className={`${mode === "signup" ? "mt-3" : "mt-6"} block text-sm font-semibold`}>
          Correo
          <input
            type="email"
            required
            autoComplete="email"
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
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>

        {mode === "login" ? (
          <div className="mt-2 text-right">
            <Link href="/recuperar" className="text-sm font-semibold text-[var(--color-ember)]">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-[var(--color-wine)]">{error}</p> : null}
        {info ? (
          <p className="mt-3 rounded-xl bg-[var(--color-cream)] px-3 py-2 text-sm text-[var(--color-sage)]">
            {info}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 h-12 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)] disabled:opacity-60"
        >
          {loading ? "Espera…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>

        <button
          type="button"
          className="mt-3 w-full text-sm font-semibold text-[var(--color-muted)]"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
            setInfo("");
          }}
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
