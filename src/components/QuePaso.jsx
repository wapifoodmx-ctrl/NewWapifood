"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { toast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";

const STEPS = ["Qué pasó", "Platillos", "Dinero", "Revisar"];

export function QuePaso({ order, onDone }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [what, setWhat] = useState("");
  const [lines, setLines] = useState([]);
  const [moneyChoice, setMoneyChoice] = useState("nada");
  const [amount, setAmount] = useState("");
  const [pay, setPay] = useState(order?.method === "tarjeta" ? "tarjeta" : order?.method === "transferencia" ? "mercadopago" : "efectivo");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const paid = order?.status === "pagada";

  useEffect(() => {
    if (!open || !order?.id) return;
    const ids = (order.order_items || []).map((item) => item.product_id).filter(Boolean);
    if (!ids.length) return;
    const supabase = createClient();
    supabase
      .from("products")
      .select("id,name,inventory_mode")
      .in("id", ids)
      .then(({ data }) => {
        const byId = Object.fromEntries((data || []).map((product) => [product.id, product]));
        setLines((order.order_items || []).filter((item) => item.status !== "cancelado").map((item) => {
          const product = byId[item.product_id] || {};
          const left = Math.max(Number(item.qty) - Number(item.resolved_qty || 0), 0);
          return {
            product_id: item.product_id,
            name: product.name || "Platillo",
            left,
            qty: left,
            stock: product.inventory_mode === "receta" ? "merma" : "regresar",
          };
        }));
      });
  }, [open, order]);

  const maxRefund = useMemo(() => {
    const food = Number(order?.charged_food || 0) || (order?.order_items || []).reduce((sum, item) => sum + Number(item.unit_price) * Number(item.qty), 0);
    const tip = Number(order?.tip_amount || 0);
    const already = Number(order?.refunded_amount || 0) + (order?.order_items || []).reduce((sum, item) => sum + Number(item.refunded_amount || 0), 0);
    return Math.max(0, Math.round((food + tip - already) * 100) / 100);
  }, [order]);

  const chosen = lines.filter((line) => line.qty > 0);
  const refundAmount = moneyChoice === "total" ? maxRefund : moneyChoice === "parcial" ? Number(amount || 0) : 0;

  function summary() {
    const dishes = chosen.map((line) => `${line.qty} ${line.name} ${line.stock === "regresar" ? "regresan al inventario" : "se pierden"}`);
    const cash = !paid || moneyChoice === "nada"
      ? "No se devuelve dinero."
      : pay === "efectivo"
        ? `Se devuelven ${money(refundAmount)} en efectivo. Salen del cajón si la caja está abierta.`
        : `Se anotan ${money(refundAmount)} como devolución pendiente de ${pay === "mercadopago" ? "Mercado Pago" : "tarjeta"}.`;
    return [...dishes, cash].filter(Boolean).join(" ");
  }

  async function confirm() {
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("apply_order_fix", {
      p_order: order.id,
      p_pin: pin || null,
      p_payload: {
        what: what === "cancelar" && paid ? "quitar" : what,
        money: what === "cancelar" && paid ? (moneyChoice === "nada" ? "total" : moneyChoice) : moneyChoice,
        pay,
        amount: refundAmount,
        items: (what === "dinero" ? [] : chosen).map((line) => ({
          product_id: line.product_id,
          qty: line.qty,
          stock: line.stock,
        })),
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(data?.summary || "Listo");
    setOpen(false);
    setStep(0);
    onDone?.();
  }

  if (!order?.id) return null;

  return (
    <div>
      <button type="button" className="btn-primary inline-flex h-14 items-center gap-2 px-4" onClick={() => { setLines([]); setOpen(true); setStep(0); }}>
        <Icon name="receipt" size={22} /> ¿Qué pasó?
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="que-paso-title">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-[18px] bg-[var(--surface)] p-5 text-[var(--ink)]">
            <p className="text-sm font-bold text-[var(--ink-soft)]">Paso {step + 1} de 4 · {STEPS[step]}</p>
            <h2 id="que-paso-title" className="mt-1 text-2xl">Vamos paso a paso</h2>

            {step === 0 ? (
              <div className="mt-4 grid gap-2">
                <Choice icon="close" title="Cancelar toda la cuenta" text={paid ? "Ya está cobrada. Luego vemos el inventario y el dinero." : "Se cancela y se libera la mesa. Todavía no hay dinero que devolver."} onClick={() => { setWhat("cancelar"); setStep(paid ? 1 : 3); }} />
                <Choice icon="dish" title="Quitar algunos platillos" text="Elige cuántos y si regresan al inventario o se pierden." onClick={() => { setWhat("quitar"); setStep(1); }} />
                <Choice icon="register" title="Devolver dinero" text={paid ? "La cuenta ya se cobró. Puedes devolver una parte o todo." : "Todavía no se ha cobrado, así que no hay dinero que devolver."} disabled={!paid} onClick={() => { setWhat("dinero"); setMoneyChoice("parcial"); setStep(2); }} />
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mt-4 grid gap-3">
                {lines.length === 0 ? <p>No hay platillos en esta cuenta.</p> : null}
                {lines.map((line) => (
                  <div key={line.product_id} className="rounded-[14px] border border-[var(--border)] p-3">
                    <p className="text-lg font-bold">{line.name}</p>
                    <p className="text-sm text-[var(--ink-soft)]">Hay {line.left}. {line.stock === "merma" ? "Sugerimos merma porque es un platillo preparado." : "Sugerimos regresarlo al inventario porque no lleva receta."}</p>
                    <label className="mt-2 block text-sm font-bold">
                      Cuántos
                      <input className="mt-1 h-12 w-24 rounded-[14px] border border-[var(--border)] px-3" inputMode="numeric" value={line.qty} onChange={(e) => {
                        const qty = Math.min(line.left, Math.max(0, Number(e.target.value.replace(/\D/g, "") || 0)));
                        setLines((list) => list.map((row) => row.product_id === line.product_id ? { ...row, qty } : row));
                      }} />
                    </label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button type="button" className={`h-12 rounded-[14px] border ${line.stock === "regresar" ? "border-[var(--accent)] font-bold" : "border-[var(--border)]"}`} onClick={() => setLines((list) => list.map((row) => row.product_id === line.product_id ? { ...row, stock: "regresar" } : row))}>Regresar al inventario</button>
                      <button type="button" className={`h-12 rounded-[14px] border ${line.stock === "merma" ? "border-[var(--accent)] font-bold" : "border-[var(--border)]"}`} onClick={() => setLines((list) => list.map((row) => row.product_id === line.product_id ? { ...row, stock: "merma" } : row))}>Se pierde (merma)</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-4 grid gap-2">
                <Choice title="No devolver dinero" text="Solo se mueve el inventario, si elegiste platillos." onClick={() => setMoneyChoice("nada")} />
                <Choice title="Devolver una parte" text={`Máximo ${money(maxRefund)}.`} onClick={() => setMoneyChoice("parcial")} />
                <Choice title="Devolver todo" text={money(maxRefund)} onClick={() => setMoneyChoice("total")} />
                {moneyChoice === "parcial" ? (
                  <label className="text-sm font-bold">
                    Cuánto
                    <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] px-3 text-xl" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
                  </label>
                ) : null}
                {moneyChoice !== "nada" ? (
                  <div className="grid gap-2">
                    <p className="font-bold">¿Cómo se devuelve?</p>
                    <button type="button" className="h-12 rounded-[14px] border border-[var(--border)] text-left px-3" onClick={() => setPay("efectivo")}>{pay === "efectivo" ? "● " : ""}Efectivo, sale del cajón</button>
                    <button type="button" className="h-12 rounded-[14px] border border-[var(--border)] text-left px-3" onClick={() => setPay("tarjeta")}>{pay === "tarjeta" ? "● " : ""}Tarjeta, queda pendiente</button>
                    <button type="button" className="h-12 rounded-[14px] border border-[var(--border)] text-left px-3" onClick={() => setPay("mercadopago")}>{pay === "mercadopago" ? "● " : ""}Mercado Pago, queda pendiente</button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-4">
                <p className="rounded-[14px] bg-[var(--bg)] p-4 text-lg">{summary()}</p>
                <label className="mt-3 block text-sm font-bold">
                  PIN de gerente, si tu local lo usa
                  <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] px-3" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Déjalo vacío si no hay PIN" />
                </label>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost h-12" onClick={() => step === 0 ? setOpen(false) : setStep((n) => Math.max(0, n - 1))}>Atrás</button>
              {step < 3 ? (
                <button type="button" className="btn-primary h-12" onClick={() => setStep((n) => Math.min(3, n + 1))}>Siguiente</button>
              ) : (
                <button type="button" className="btn-danger h-14" disabled={busy} onClick={confirm}>{busy ? "Guardando…" : "Confirmar"}</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Choice({ icon, title, text, onClick, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-14 items-start gap-3 rounded-[14px] border border-[var(--border)] p-3 text-left disabled:opacity-50">
      {icon ? <Icon name={icon} size={22} /> : null}
      <span>
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm text-[var(--ink-soft)]">{text}</span>
      </span>
    </button>
  );
}
