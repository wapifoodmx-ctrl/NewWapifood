'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { confirmAsync } from "@/components/ui/confirm";
import { planMeta } from "@/lib/plans";

export function SucursalesManager({ restaurantId }) {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [caps, setCaps] = useState(null);
  const [name, setName] = useState("");
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) { setLoading(false); return; }
    const { data: ms } = await supabase
      .from("memberships")
      .select("restaurant_id, role, restaurants(id, name)")
      .eq("user_id", u.user.id);
    setList(ms || []);
    const anchor = restaurantId || ms?.[0]?.restaurant_id;
    if (anchor) {
      const { data: c } = await supabase.rpc("restaurant_caps", { p_restaurant: anchor });
      if (c && c.length) setCaps(c[0]);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: u }) => {
      if (!active || !u?.user) { setLoading(false); return; }
      supabase
        .from("memberships")
        .select("restaurant_id, role, restaurants(id, name)")
        .eq("user_id", u.user.id)
        .then(({ data: ms }) => {
          if (!active) return;
          setList(ms || []);
          const anchor = restaurantId || ms?.[0]?.restaurant_id;
          if (anchor) {
            supabase.rpc("restaurant_caps", { p_restaurant: anchor }).then(({ data: c }) => {
              if (!active) return;
              if (c && c.length) setCaps(c[0]);
            });
          }
          setLoading(false);
        });
    });
    return () => { active = false; };
  }, [restaurantId]);

  async function add() {
    if (!name.trim()) { toast.warning("Escribe un nombre para la sucursal"); return; }
    const ok = await confirmAsync(`¿Crear la sucursal "${name.trim()}"?`, { title: "Nueva sucursal", confirmLabel: "Crear" });
    if (!ok) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_additional_restaurant", {
      p_name: name.trim(),
      p_restaurant: restaurantId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sucursal creada");
    setName("");
    await refresh();
    router.refresh();
  }

  async function copyMenu() {
    if (!dest) { toast.warning("Elige el local que va a recibir el menú"); return; }
    const ok = await confirmAsync("Se copian platillos, extras y recetas. El inventario del otro local no se llena: los insumos nuevos quedan en cero.", {
      title: "Copiar menú",
      confirmLabel: "Copiar",
    });
    if (!ok) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("copy_restaurant_menu", {
      p_from: restaurantId,
      p_to: dest,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(Number(data) > 0 ? `Se copiaron ${data} platillos` : "Este local no tiene platillos para copiar");
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Cargando sucursales…</p>;

  const used = list.length;
  const max = caps?.max_restaurants ?? 1;
  const canAdd = used < max;

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
      <h2 className="text-xl font-semibold">Sucursales</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {used} de {max} restaurante{max === 1 ? "" : "s"} del plan {caps?.plan ? planMeta(caps.plan).title : "—"}.
      </p>
      <ul className="mt-3 space-y-2">
        {list.map((m) => (
          <li key={m.restaurant_id} className="flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3 py-2 text-sm">
            <span className="font-semibold">{m.restaurants?.name || "Restaurante"}</span>
            <span className="text-xs text-[var(--color-muted)]">{m.role}</span>
          </li>
        ))}
      </ul>
      {canAdd ? (
        <div className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la sucursal"
            className="h-10 flex-1 rounded-[3px] border border-[var(--color-line)] bg-[var(--color-parchment)] px-3 text-sm"
          />
          <button type="button" onClick={add} disabled={busy} className="btn-primary h-10 px-4">
            {busy ? "Creando…" : "Agregar sucursal"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Llegaste al límite de restaurantes de tu plan. Mejora el plan para agregar más.
        </p>
      )}
      {list.length > 1 ? (
        <div className="mt-4 grid gap-2">
          <p className="text-sm text-[var(--color-muted)]">
            Copiar el menú de este local a otro. No borra lo que ya tiene el destino y no copia existencias.
          </p>
          <div className="flex gap-2">
            <select
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              aria-label="Local que recibe el menú"
              className="h-12 flex-1 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-parchment)] px-3 text-sm"
            >
              <option value="">Elige el otro local</option>
              {list.filter((m) => m.restaurant_id !== restaurantId).map((m) => (
                <option key={m.restaurant_id} value={m.restaurant_id}>
                  {m.restaurants?.name || "Restaurante"}
                </option>
              ))}
            </select>
            <button type="button" onClick={copyMenu} disabled={busy} className="btn-primary h-12 px-4">
              Copiar menú
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
