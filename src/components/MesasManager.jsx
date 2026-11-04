"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import { tableStateMeta } from "@/lib/brand";
import { confirmAsync } from "@/components/ui/confirm";

const CHANNELS = [
  { id: "caja", label: "Caja (POS)" },
  { id: "piso", label: "Piso" },
  { id: "tablet", label: "Tablet de mesa" },
  { id: "kiosko", label: "Kiosko" },
];

export function MesasManager({ restaurantId, initialTables, tableLimit = null }) {
  const [tables, setTables] = useState(initialTables);
  const [areas, setAreas] = useState([]);
  const [areasReady, setAreasReady] = useState(false);
  const [areaId, setAreaId] = useState("");
  const [areaName, setAreaName] = useState("");
  const [live, setLive] = useState(false);
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState("2");
  const [channel, setChannel] = useState("piso");

  useEffect(() => {
    if (!restaurantId) return;
    const supabase = createClient();

    async function pull() {
      const { data } = await supabase
        .from("dining_tables")
        .select("id,number,seats,channel_type,state,active,access_pin,area_id")
        .eq("restaurant_id", restaurantId)
        .order("number");
      if (data) setTables(data);
    }

    const ch = supabase
      .channel(`mesas-live-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dining_tables", filter: `restaurant_id=eq.${restaurantId}` },
        () => pull(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    supabase
      .from("dining_areas")
      .select("id,name,sort_order")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .then(({ data, error }) => {
        if (!error) {
          setAreas(data || []);
          setAreasReady(true);
        }
      });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function ensureDefaults() {
    setErr("");
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase.rpc("ensure_channel_tables", {
      p_restaurant: restaurantId,
    });
    if (error) return setErr(error.message + " — ¿corriste SQL 013?");
    const { data } = await supabase
      .from("dining_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("number");
    setTables(data || []);
    setMsg("Canales base listos: caja (mesa 1) y kiosko.");
  }

  async function addTable(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const n = Number(number);
    const s = Number(seats);
    if (!n || n < 1) return setErr("Número de mesa inválido");
    if (!s || s < 1) return setErr("Lugares inválidos");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dining_tables")
      .insert({
        restaurant_id: restaurantId,
        number: n,
        seats: s,
        state: "libre",
        active: true,
        channel_type: channel,
        access_pin: channel === "tablet" ? pin || null : null,
        ...(areasReady && areaId ? { area_id: areaId } : {}),
      })
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setTables((t) => [...t, data].sort((a, b) => a.number - b.number));
    setNumber("");
    setSeats("2");
    setPin("");
    setChannel("piso");
  }

  async function addArea(e) {
    e.preventDefault();
    const name = areaName.trim();
    if (!name) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dining_areas")
      .insert({ restaurant_id: restaurantId, name, sort_order: areas.length })
      .select("id,name,sort_order")
      .single();
    if (error) return setErr(error.message);
    setAreas((list) => [...list, data]);
    setAreaId(data.id);
    setAreaName("");
    setAreasReady(true);
  }

  async function assignArea(table, nextArea) {
    const supabase = createClient();
    const { error } = await supabase.from("dining_tables").update({ area_id: nextArea || null }).eq("id", table.id);
    if (error) return setErr(error.message);
    setTables((list) => list.map((t) => (t.id === table.id ? { ...t, area_id: nextArea || null } : t)));
  }

  async function releaseIdle() {
    const ok = await confirmAsync("Las mesas ocupadas sin cuenta abierta pasan a libres. Las no disponibles se quedan así.", {
      title: "Liberar mesas vacías",
      confirmLabel: "Liberar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    const supabase = createClient();
    const { data: openOrders } = await supabase
      .from("orders")
      .select("table_id")
      .eq("restaurant_id", restaurantId)
      .not("status", "in", "(pagada,cancelada)");
    const busy = new Set((openOrders || []).map((o) => o.table_id));
    let freed = 0;
    for (const table of tables) {
      if (table.state !== "ocupada" || busy.has(table.id)) continue;
      const { error } = await supabase.rpc("set_table_state", { p_table: table.id, p_state: "libre" });
      if (!error) {
        freed += 1;
        setTables((list) => list.map((t) => (t.id === table.id ? { ...t, state: "libre" } : t)));
      }
    }
    toast.success(freed ? `${freed} mesa${freed === 1 ? "" : "s"} libre${freed === 1 ? "" : "s"}` : "No había mesas ocupadas sin cuenta");
  }

  async function setType(t, type) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dining_tables")
      .update({ channel_type: type })
      .eq("id", t.id)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setTables((xs) => xs.map((x) => (x.id === t.id ? data : x)));
  }

  
  async function setState(t, state) {
    const supabase = createClient();
    const { error } = await supabase.rpc("set_table_state", { p_table: t.id, p_state: state });
    if (error) {
      // fallback direct update
      const { error: e2 } = await supabase.from("dining_tables").update({ state }).eq("id", t.id);
      if (e2) return toast?.error ? toast.error(error.message) : alert(error.message);
    }
    setTables((xs) => xs.map((x) => (x.id === t.id ? { ...x, state } : x)));
  }

  async function toggle(t) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dining_tables")
      .update({ active: !t.active })
      .eq("id", t.id)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setTables((xs) => xs.map((x) => (x.id === t.id ? data : x)));
  }

  async function remove(id) {
    if (!(await confirmAsync("¿Eliminar esta mesa?", { title: "Eliminar mesa" }))) return;
    const supabase = createClient();
    const { error } = await supabase.from("dining_tables").delete().eq("id", id);
    if (error) return setErr(error.message);
    setTables((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={ensureDefaults}
            className="h-10 rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold"
          >
            Crear caja + kiosko base
          </button>
          <button type="button" onClick={releaseIdle} className="h-10 rounded-full bg-[var(--color-cream)] px-4 text-sm font-semibold">
            Liberar mesas vacías
          </button>
          {tableLimit ? (
            <span className="text-sm text-[var(--ink-soft)]">
              Piso y tablet: {tables.filter((t) => t.active !== false && (t.channel_type === "piso" || t.channel_type === "tablet")).length}/{tableLimit}
            </span>
          ) : null}
          {msg ? <span className="text-sm text-[var(--color-sage)]">{msg}</span> : null}
        </div>
        {!tables.length ? (
          <EmptyState icon="table" title="Todavía no hay mesas" text="Crea la caja, el kiosko o la primera mesa del salón." />
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tables.map((t) => {
            const meta = tableStateMeta(t.state, t.state === "ocupada");
            return (
            <article
              key={t.id}
              className={`table-tile tone-${t.active ? meta.tone : "off"} !min-h-0 w-full ${t.active ? "" : "opacity-70"}`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-2xl font-extrabold">Mesa {t.number}</p>
                <Icon name={meta.icon} size={22} />
              </div>
              <p className="text-base font-bold">
                {meta.label} · {t.seats} lugares
              </p>
              <p className="text-base text-[var(--ink-soft)]">
                {t.channel_type === "caja" ? "Caja" : t.channel_type === "kiosko" ? "Kiosko" : t.channel_type === "tablet" ? "Tablet" : "Piso"}
                {t.active ? "" : " · pausada"}
              </p>
              {areasReady ? (
                <select
                  aria-label={`Área de la mesa ${t.number}`}
                  className="mt-2 h-9 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-cream)] px-2 text-xs"
                  value={t.area_id || ""}
                  onChange={(e) => assignArea(t, e.target.value)}
                >
                  <option value="">Sin área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : null}
              <select
                className="mt-2 h-9 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-cream)] px-2 text-xs"
                value={t.channel_type || "piso"}
                onChange={(e) => setType(t, e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {(t.channel_type === "tablet" || t.channel_type === "piso") ? (
                <p className="mt-2 break-all text-base text-[var(--ink-soft)]">
                  Enlace de tablet: /tablet/{t.id}
                </p>
              ) : null}
              <div className="mt-3 flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => toggle(t)} className="btn-ghost px-3">
                  {t.active ? "Pausar" : "Activar"}
                </button>
                <button type="button" onClick={() => setState(t, t.state === "no_disponible" ? "libre" : "no_disponible")} className="btn-ghost px-3">
                  {t.state === "no_disponible" ? "Habilitar" : "No disponible"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="btn-danger px-3"
                >
                  Eliminar
                </button>
              </div>
            </article>
            );
          })}
        </div>
      </div>

      <form onSubmit={addTable} className="h-fit rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-sage)]">{live ? "En vivo · estados de mesa" : "Conectando…"}</p>
      <h2 className="text-xl font-semibold">Nueva mesa / canal</h2>
        <label className="mt-3 block text-sm font-semibold">
          Número
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        <label className="mt-2 block text-sm font-semibold">
          Lugares
          <input
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          />
        </label>
        <label className="mt-2 block text-sm font-semibold">
          Canal
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
          >
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {areasReady ? (
          <label className="mt-2 block text-sm font-semibold">
            Área
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
            >
              <option value="">Sin área</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {channel === "tablet" ? (
          <label className="mt-2 block text-sm font-semibold">
            PIN tablet (opcional)
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
            />
          </label>
        ) : null}
        {areasReady ? (
          <div className="mt-3 flex gap-2">
            <input
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="Nueva área, ej. Terraza"
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] px-3"
            />
            <button type="button" onClick={addArea} className="btn-ghost px-3">Crear área</button>
          </div>
        ) : null}
        {err ? <p className="mt-2 text-sm text-[var(--color-wine)]">{err}</p> : null}
        <button
          type="submit"
          className="mt-4 h-11 w-full rounded-full bg-[var(--color-ink)] font-semibold text-[var(--color-cream)]"
        >
          Guardar
        </button>
      </form>
    </div>
  );
}
