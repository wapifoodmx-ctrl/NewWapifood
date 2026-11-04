"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

export function ClientesPanel({ restaurantId, initial }) {
  const [rows, setRows] = useState(initial || []);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      `${r.name || ""} ${r.phone || ""} ${r.address || ""}`.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  async function save(e) {
    e.preventDefault();
    const phone = form.phone.trim();
    if (phone.length < 8) {
      toast.warning("El teléfono necesita al menos 8 dígitos");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .upsert(
        {
          restaurant_id: restaurantId,
          name: form.name.trim() || null,
          phone,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        },
        { onConflict: "restaurant_id,phone" },
      )
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setRows((list) => {
      const rest = list.filter((r) => r.id !== data.id && r.phone !== data.phone);
      return [data, ...rest];
    });
    setForm({ name: "", phone: "", address: "", notes: "" });
    toast.success("Cliente guardado");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={save} className="card grid gap-2 p-5">
        <h2 className="text-2xl">Nuevo cliente</h2>
        <p className="text-base text-[var(--ink-soft)]">
          El domicilio y la caja también lo anotan cuando el pedido trae teléfono.
        </p>
        <label className="text-sm font-bold">
          Nombre
          <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="text-sm font-bold">
          Teléfono
          <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" required />
        </label>
        <label className="text-sm font-bold">
          Dirección
          <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="text-sm font-bold">
          Nota
          <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <button type="submit" className="btn-primary">Guardar</button>
      </form>
      <section className="card p-5">
        <label className="block text-sm font-bold">
          Buscar
          <input className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o teléfono" />
        </label>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {visible.length === 0 ? <li className="py-4 text-[var(--ink-soft)]">No hay clientes con ese dato.</li> : null}
          {visible.map((c) => (
            <li key={c.id} className="py-3">
              <p className="text-lg font-extrabold">{c.name || "Sin nombre"}</p>
              <p>{c.phone}</p>
              {c.address ? <p className="text-[var(--ink-soft)]">{c.address}</p> : null}
              <p className="text-sm text-[var(--ink-soft)]">
                {c.visits || 1} pedido{(c.visits || 1) === 1 ? "" : "s"}
                {c.last_seen ? ` · último ${new Date(c.last_seen).toLocaleDateString("es-MX")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
