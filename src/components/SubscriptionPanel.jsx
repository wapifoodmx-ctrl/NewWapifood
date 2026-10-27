"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS, moneyMX, planMeta } from "@/lib/plans";

export function SubscriptionPanel({ restaurantId, initialSubs }) {
  const [subs, setSubs] = useState(initialSubs || []);
  const [billing, setBilling] = useState("mensual");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const current = subs[0];
  const meta = current ? planMeta(current.plan) : null;
  const active =
    current &&
    (current.status === "active" || current.status === "trialing") &&
    (!current.ends_at || new Date(current.ends_at) > new Date());

  async function activate(planId) {
    setErr("");
    setMsg("");
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("activate_plan", {
        p_restaurant: restaurantId,
        p_plan: planId,
        p_billing: billing,
      });
      if (error) throw error;
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      setSubs(data || []);
      setMsg("Plan activado. (Modo prueba: sin pasarela; luego conectamos Stripe/MP.)");
    } catch (e) {
      setErr(e.message || "No se pudo activar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ember)]">Estado actual</p>
        {current ? (
          <>
            <h2 className="mt-2 text-3xl">{meta?.title || current.plan}</h2>
            <p className="mt-1 text-[var(--color-muted)]">
              Estado: <strong>{current.status}</strong>
              {current.ends_at
                ? ` · vigente hasta ${new Date(current.ends_at).toLocaleDateString("es-MX")}`
                : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {active ? "Tu restaurante puede operar con normalidad." : "Plan vencido o inactivo: renueva para continuar."}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-3xl">Sin plan registrado</h2>
            <p className="mt-1 text-[var(--color-muted)]">Elige un plan para activar el servicio.</p>
          </>
        )}
      </section>

      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] p-1">
          <button
            type="button"
            onClick={() => setBilling("mensual")}
            className={`h-10 rounded-full px-5 text-sm font-semibold ${billing === "mensual" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-muted)]"}`}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setBilling("anual")}
            className={`h-10 rounded-full px-5 text-sm font-semibold ${billing === "anual" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-muted)]"}`}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = billing === "anual" ? p.yearly : p.monthly;
          const isCurrent = current?.plan === p.id && active;
          return (
            <article key={p.id} className={`rounded-2xl border p-5 ${isCurrent ? "border-[var(--color-ember)] bg-[var(--color-cream)]" : "border-[var(--color-line)] bg-[var(--color-paper)]"}`}>
              <h3 className="text-xl font-semibold">{p.title}</h3>
              <p className="mt-2 text-3xl font-semibold">
                {moneyMX(price)}
                <span className="ml-1 text-sm font-normal text-[var(--color-muted)]">
                  / {billing === "anual" ? "año" : "mes"}
                </span>
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Hasta {p.mesas} mesas · {p.meseros} meseros
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => activate(p.id)}
                className="mt-4 h-11 w-full rounded-full bg-[var(--color-ink)] text-sm font-semibold text-[var(--color-cream)] disabled:opacity-60"
              >
                {isCurrent ? "Renovar / mantener" : "Activar plan"}
              </button>
            </article>
          );
        })}
      </div>

      {err ? <p className="text-sm text-[var(--color-wine)]">{err}</p> : null}
      {msg ? <p className="text-sm text-[var(--color-sage)]">{msg}</p> : null}

      {subs.length > 1 ? (
        <section>
          <h3 className="mb-2 text-lg font-semibold">Historial</h3>
          <ul className="space-y-2 text-sm">
            {subs.map((s) => (
              <li key={s.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2">
                {s.plan} · {s.status} · {moneyMX(s.amount)} · {s.billing}
                {s.ends_at ? ` · hasta ${new Date(s.ends_at).toLocaleDateString("es-MX")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
