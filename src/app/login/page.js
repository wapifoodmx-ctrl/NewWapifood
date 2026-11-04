"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/brand";
import { homePath } from "@/lib/modules";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function goHome(supabase) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const { data: mem } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    router.push(homePath(mem?.role));
    router.refresh();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        await supabase.rpc("create_my_restaurant", {
          p_name: restaurantName || "Mi restaurante",
        });
        await goHome(supabase);
        return;
      }

      if (password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      }

      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
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
          "Te enviamos un correo para confirmar tu cuenta. Ábrelo y toca el enlace. Revisa también el spam. Después ya puedes entrar.",
        );
        return;
      }

      await supabase.rpc("create_my_restaurant", {
        p_name: restaurantName || "Mi restaurante",
      });
      router.push("/empezar");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="brand text-3xl">Wapifood</p>
          <ThemeToggle />
        </div>
        <h1 className="mt-4 text-4xl">{mode === "login" ? "Entra a tu cuenta" : "Crea tu cuenta"}</h1>
        <p className="mt-2 text-lg text-[var(--ink-soft)]">
          {mode === "login"
            ? "Usa el correo con el que te registraste."
            : "Te llega un correo para confirmar. Luego armas tu carta, paso a paso."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2" aria-label="Entrar o crear cuenta">
          <button type="button" className={mode === "login" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("login"); setError(""); setInfo(""); }} aria-pressed={mode === "login"}>
            Ya tengo cuenta
          </button>
          <button type="button" className={mode === "signup" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("signup"); setError(""); setInfo(""); }} aria-pressed={mode === "signup"}>
            Soy nuevo
          </button>
        </div>

        {mode === "signup" ? (
          <label className="mt-5 block text-base font-bold">
            Nombre del restaurante
            <input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Ej. Taquería El Patio"
              className="mt-1 w-full"
            />
          </label>
        ) : null}

        <label className="mt-4 block text-base font-bold">
          Correo
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full"
            placeholder="tunombre@correo.com"
          />
        </label>

        <label className="mt-4 block text-base font-bold">
          Contraseña
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-2 flex min-h-12 items-center gap-2 text-base">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Mostrar contraseña
        </label>

        {mode === "login" ? (
          <div className="mt-2 text-right">
            <Link href="/recuperar" className="text-base font-bold text-[var(--primary)] underline">
              Olvidé mi contraseña
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-2xl bg-[var(--chip-bad-bg)] px-3 py-2 text-base text-[var(--chip-bad-fg)]" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mt-3 rounded-2xl bg-[var(--chip-ok-bg)] px-3 py-2 text-base text-[var(--chip-ok-fg)]" role="status">
            {info}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className="btn-lg btn-primary mt-5 w-full">
          {loading ? "Espera un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>

        <Link href="/" className="mt-4 block text-center text-base text-[var(--ink-soft)]">
          Volver al inicio
        </Link>
      </form>
    </div>
  );
}
