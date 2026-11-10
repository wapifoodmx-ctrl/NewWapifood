"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { askManagerPin } from "@/lib/managerPin";

export function MesaTools({ order, tables, orders, marked = [], onDone }) {
  const [tableId, setTableId] = useState("");
  const [otherId, setOtherId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  if (!order) return null;
  const others = (orders || []).filter((row) => row.id !== order.id && !["pagada", "cancelada"].includes(row.status));

  async function run(label, fn) {
    const pin = askManagerPin();
    if (pin == null) return;
    setBusy(true);
    const error = await fn(pin || null);
    setBusy(false);
    if (error) return toast.error(error.message || String(error));
    toast.success(label);
    onDone?.();
  }

  return (
    <div className="grid gap-2 rounded-[14px] border border-[var(--border)] p-3">
      <p className="font-bold">Mesas y cuentas</p>
      <select className="h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2" value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Mesa destino">
        <option value="">Mesa destino</option>
        {(tables || []).filter((table) => table.id !== order.table_id).map((table) => (
          <option key={table.id} value={table.id}>Mesa {table.number}</option>
        ))}
      </select>
      <button type="button" className="btn-ghost h-12" disabled={busy || !tableId} onClick={() => run("Cuenta transferida", async (pin) => {
        const { error } = await createClient().rpc("transfer_table", { p_order: order.id, p_table: tableId, p_pin: pin });
        return error;
      })}>Transferir a esa mesa</button>
      <select className="h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2" value={otherId} onChange={(e) => setOtherId(e.target.value)} aria-label="Otra cuenta">
        <option value="">Otra cuenta abierta</option>
        {others.map((row) => (
          <option key={row.id} value={row.id}>Mesa {row.dining_tables?.number || "sin número"}</option>
        ))}
      </select>
      <button type="button" className="btn-ghost h-12" disabled={busy || !otherId} onClick={() => run("Cuentas juntadas", async (pin) => {
        const { error } = await createClient().rpc("merge_orders", { p_from: order.id, p_to: otherId, p_pin: pin });
        return error;
      })}>Juntar esta cuenta con la otra</button>
      <button type="button" className="btn-ghost h-12" disabled={busy || !otherId} onClick={() => run("Platillos movidos", async (pin) => {
        const items = (order.order_items || []).map((item) => ({ product_id: item.product_id, qty: item.qty }));
        const { error } = await createClient().rpc("move_order_items", { p_from: order.id, p_to: otherId, p_items: items, p_pin: pin });
        return error;
      })}>Pasar todos los platillos</button>
      <label className="text-sm font-bold">
        Dividir un monto
        <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] px-3" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
      </label>
      <button type="button" className="btn-ghost h-12" disabled={busy || !amount} onClick={() => run("Cuenta dividida por monto", async (pin) => {
        const { error } = await createClient().rpc("split_order", {
          p_order: order.id,
          p_mode: "monto",
          p_payload: { amount: Number(amount) },
          p_pin: pin,
        });
        return error;
      })}>Dividir por monto</button>
      <button type="button" className="btn-ghost h-12" disabled={busy || marked.length === 0} onClick={() => run("Platillos separados", async (pin) => {
        const items = marked.map((item) => ({ product_id: item.product_id, qty: item.qty }));
        const { error } = await createClient().rpc("split_order", {
          p_order: order.id,
          p_mode: "persona",
          p_payload: { items },
          p_pin: pin,
        });
        return error;
      })}>Dividir lo marcado por persona</button>
    </div>
  );
}
