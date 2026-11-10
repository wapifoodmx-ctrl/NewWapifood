"use client";

import { useState } from "react";
import { PLANS, moneyMX, planMeta } from "@/lib/plans";

export function SubscriptionPanel({ restaurantId, initialSubs }) {
  const [subs] = useState(initialSubs || []);
  const [billing, setBilling] = useState("mensual");
  const [mode, setMode] = useState("single");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const current =
    subs.find((s) => s.status === "active" || s.status === "trialing") || subs[0];
  const meta = current ? planMeta(current.plan) : null;
  const active =
    current &&
    (current.status === "active" || current.status === "trialing") &&
    (!current.ends_at || new Date(current.ends_at) > new Date());

  async function payWithMP(planId) {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/mercadopago/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billing, restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el pago");
      const url = data.init_point || data.sandbox_init_point;
      if (!url) throw new Error("Mercado Pago no devolvió link de pago");
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = url;
    } catch (e) {
      setErr(e.message || "Error con Mercado Pago");
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
            {meta ? (
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Hasta {meta.mesas} mesas y {meta.meseros} meseros
                {meta.multi ? ` por local · ${meta.restaurants} locales` : ""}.
              </p>
            ) : null}
            <p className="mt-1 text-[var(--color-muted)]">
              Estado: <strong>{current.status}</strong>
              {current.provider ? ` · ${current.provider}` : ""}
              {current.ends_at
                ? ` · vigente hasta ${new Date(current.ends_at).toLocaleDateString("es-MX")}`
                : ""}
            </p>
          </>
        ) : (
          <h2 className="mt-2 text-3xl">Sin plan registrado</h2>
        )}
      </section>

      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] p-1">
          <button type="button" onClick={() => setMode("single")} className={`h-10 rounded-full px-5 text-sm font-semibold ${mode === "single" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-muted)]"}`}>Un local</button>
          <button type="button" onClick={() => setMode("multi")} className={`h-10 rounded-full px-5 text-sm font-semibold ${mode === "multi" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-muted)]"}`}>Varios locales</button>
        </div>
        <div className="inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-cream)] p-1">
          <button type="button" onClick={() => setBilling("mensual")} className={`h-10 rounded-full px-5 text-sm font-semibold ${billing === "mensual" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-muted)]"}`}>Mensual</button>
          <button type="button" onClick={() => setBilling("anual")} className={`h-10 rounded-full px-5 text-sm font-semibold ${billing === "anual" ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-muted)]"}`}>Anual · 2 meses gratis</button>
        </div>
      </div>
      <p className="text-center text-sm text-[var(--color-muted)]">
        {mode === "multi"
          ? "El precio es el total de todos los locales. Cada uno conserva sus mesas y meseros. "
          : null}
        Si bajas de plan y ya tienes más mesas o meseros, no se borran. Solo no podrás dar de alta más hasta que quites los que sobran.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.filter((p) => (mode === "multi") === !!p.multi).map((p) => {
          const price = billing === "anual" ? p.yearly : p.monthly;
          const body = (
            <>
              <h3 className="text-xl font-semibold">{p.title}</h3>
              <p className="mt-2 text-3xl font-semibold">
                {moneyMX(price)}
                <span className="ml-1 text-sm font-normal text-[var(--color-muted)]">/ {billing === "anual" ? "año" : "mes"}</span>
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Hasta {p.mesas} mesas · {p.meseros} meseros{p.multi ? " por local" : ""}
                {p.multi ? ` · ${p.restaurants} locales` : ""}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => payWithMP(p.id)}
                className="mt-4 h-11 w-full rounded-full bg-[var(--color-ember)] text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Redirigiendo…" : "Pagar con Mercado Pago"}
              </button>
            </>
          );
          return (
            <article key={p.id} className="card p-5">
              {body}
            </article>
          );
        })}
      </div>

      {err ? <p className="text-sm text-[var(--color-wine)]">{err}</p> : null}
      {msg ? <p className="text-sm text-[var(--color-sage)]">{msg}</p> : null}

      {subs.length > 0 ? (
        <section>
          <h3 className="mb-2 text-lg font-semibold">Historial</h3>
          <ul className="space-y-2 text-sm">
            {subs.map((s) => (
              <li key={s.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2">
                {planMeta(s.plan).title} · {s.status} · {moneyMX(s.amount)} · {s.provider || "—"}
                {s.ends_at ? ` · hasta ${new Date(s.ends_at).toLocaleDateString("es-MX")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
