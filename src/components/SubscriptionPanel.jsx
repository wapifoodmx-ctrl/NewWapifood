"use client";

import { useState } from "react";
import { moneyMX, planMeta } from "@/lib/plans";
import { PricingSection } from "@/components/PricingSection";

export function SubscriptionPanel({ restaurantId, initialSubs }) {
  const [subs] = useState(initialSubs || []);
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

  async function payWithMP(plan, billing) {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/mercadopago/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, billing, restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el pago");
      const url = data.init_point || data.sandbox_init_point;
      if (!url) throw new Error("Mercado Pago no devolvió link de pago");
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

      <p className="text-center text-sm text-[var(--color-muted)]">
        Si bajas de plan y ya tienes más mesas o meseros, no se borran. Solo no podrás dar de alta más hasta que quites los que sobran.
      </p>
      <PricingSection onChoose={payWithMP} busy={loading} />

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
