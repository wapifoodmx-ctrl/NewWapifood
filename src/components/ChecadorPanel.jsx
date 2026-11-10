"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

export function ChecadorPanel({ restaurantId }) {
  const [waiters, setWaiters] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [today, setToday] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [{ data: people }, { data: open }, { data: done }] = await Promise.all([
      supabase.from("waiters").select("id,name,active").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
      supabase.from("staff_shifts").select("id,waiter_id,started_at").eq("restaurant_id", restaurantId).is("ended_at", null),
      supabase.from("staff_shifts").select("id,waiter_id,started_at,ended_at").eq("restaurant_id", restaurantId).gte("started_at", start.toISOString()).order("started_at", { ascending: false }),
    ]);
    setWaiters(people || []);
    setOpenShifts(open || []);
    setToday(done || []);
  }

  useEffect(() => {
    const supabase = createClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("waiters").select("id,name,active").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
      supabase.from("staff_shifts").select("id,waiter_id,started_at").eq("restaurant_id", restaurantId).is("ended_at", null),
      supabase.from("staff_shifts").select("id,waiter_id,started_at,ended_at").eq("restaurant_id", restaurantId).gte("started_at", start.toISOString()).order("started_at", { ascending: false }),
    ]).then(([people, open, done]) => {
      setWaiters(people.data || []);
      setOpenShifts(open.data || []);
      setToday(done.data || []);
    });
  }, [restaurantId]);

  async function punch(waiter, inside) {
    setBusy(true);
    const supabase = createClient();
    const { error } = inside
      ? await supabase.rpc("clock_out", { p_waiter: waiter.id })
      : await supabase.rpc("clock_in", { p_restaurant: restaurantId, p_waiter: waiter.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(inside ? `${waiter.name} salió` : `${waiter.name} entró`);
    await load();
  }

  const openIds = new Set(openShifts.map((shift) => shift.waiter_id));
  const names = Object.fromEntries(waiters.map((waiter) => [waiter.id, waiter.name]));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="text-2xl">¿Quién entra?</h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {waiters.length === 0 ? <li className="py-2 text-[var(--ink-soft)]">No hay meseros activos.</li> : null}
          {waiters.map((waiter) => {
            const inside = openIds.has(waiter.id);
            return (
              <li key={waiter.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{waiter.name}</p>
                  <p className="text-sm text-[var(--ink-soft)]">{inside ? "Está adentro" : "Está afuera"}</p>
                </div>
                <button type="button" className={inside ? "btn-danger h-12" : "btn-primary h-12"} disabled={busy} onClick={() => punch(waiter, inside)}>
                  {inside ? "Salida" : "Entrada"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">Hoy</h2>
        <ul className="mt-3 space-y-2">
          {today.length === 0 ? <li className="text-[var(--ink-soft)]">Nadie ha checado hoy.</li> : null}
          {today.map((shift) => (
            <li key={shift.id}>
              <span className="font-bold">{names[shift.waiter_id] || "Mesero"}</span>
              <span className="text-sm text-[var(--ink-soft)]">
                {" "}· {new Date(shift.started_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                {shift.ended_at ? ` a ${new Date(shift.ended_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : " · sigue adentro"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
