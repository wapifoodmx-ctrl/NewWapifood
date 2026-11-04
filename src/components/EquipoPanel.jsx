"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { roleLabel } from "@/lib/modules";

const ROLES = [
  { id: "admin", label: "Administración" },
  { id: "piso", label: "Caja y piso" },
  { id: "cocina", label: "Cocina" },
];

export function EquipoPanel({ restaurantId, initial, currentUserId, canManage }) {
  const [members, setMembers] = useState(initial?.members || []);
  const [invites, setInvites] = useState(initial?.invites || []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("piso");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_team", { p_restaurant: restaurantId });
    if (error) return toast.error(error.message);
    setMembers(data?.members || []);
    setInvites(data?.invites || []);
  }

  async function invite(e) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("invite_team_member", {
      p_restaurant: restaurantId,
      p_email: email,
      p_role: role,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEmail("");
    toast.success("Invitación guardada. Entra con ese correo para unirse.");
    await reload();
  }

  async function changeRole(userId, next) {
    const supabase = createClient();
    const { error } = await supabase.rpc("set_member_role", {
      p_restaurant: restaurantId,
      p_user: userId,
      p_role: next,
    });
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    await reload();
  }

  async function remove(userId, label) {
    const ok = await confirmAsync(`¿Quitar a ${label} del restaurante? Su cuenta sigue existiendo, solo pierde el acceso aquí.`, {
      title: "Quitar del equipo",
      confirmLabel: "Quitar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_member", {
      p_restaurant: restaurantId,
      p_user: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Acceso quitado");
    await reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <section className="card p-5">
        <h2 className="text-2xl">Quién entra al panel</h2>
        <p className="mt-1 text-base text-[var(--ink-soft)]">
          Los meseros de piso no usan esta lista: entran con su código en el menú de mesero. Una cuenta solo puede pertenecer a un restaurante.
        </p>
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-bold">{m.email || "Sin correo"}</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {m.user_id === currentUserId ? "Tú · " : ""}
                  {roleLabel(m.role) || m.role}
                </p>
              </div>
              {canManage && m.user_id !== currentUserId ? (
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label={`Rol de ${m.email || "miembro"}`}
                    className="h-12 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2"
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value)}
                  >
                    {m.role === "owner" ? <option value="owner">Dueño</option> : null}
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-danger px-3" onClick={() => remove(m.user_id, m.email || "esta persona")}>
                    Quitar
                  </button>
                </div>
              ) : (
                <span className="chip">{roleLabel(m.role) || m.role}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">Invitar</h2>
        {canManage ? (
          <form onSubmit={invite} className="mt-3 grid gap-2">
            <label className="text-sm font-bold">
              Correo
              <input type="email" required className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="caja@restaurante.com" />
            </label>
            <label className="text-sm font-bold">
              Rol
              <select className="mt-1 h-12 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary" disabled={busy}>Guardar invitación</button>
          </form>
        ) : (
          <p className="mt-2 text-[var(--ink-soft)]">Solo dueño y administración invitan o cambian roles.</p>
        )}
        <h3 className="mt-6 text-lg font-extrabold">Pendientes</h3>
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {invites.length === 0 ? <li className="py-2 text-[var(--ink-soft)]">No hay invitaciones abiertas.</li> : null}
          {invites.map((i) => (
            <li key={i.id} className="py-2">
              <p className="font-bold">{i.email}</p>
              <p className="text-sm text-[var(--ink-soft)]">{roleLabel(i.role) || i.role}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
