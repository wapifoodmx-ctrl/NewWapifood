'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Permite cambiar de restaurante cuando el usuario pertenece a varios.
// Guarda la selección en cookie y refresca para que el servidor la use.
export function RestaurantSwitcher({ className = "" }) {
  const router = useRouter();
  const [memberships, setMemberships] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data?.user) { setLoading(false); return; }
      supabase
        .from("memberships")
        .select("restaurant_id, role, restaurants(id, name)")
        .eq("user_id", data.user.id)
        .then(({ data: ms }) => {
          if (!active) return;
          const list = ms || [];
          setMemberships(list);
          // current = cookie value if valid, else first
          const cookieMatch = document.cookie.match(/(?:^|; )active_restaurant_id=([^;]+)/);
          const cookieId = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
          const valid = list.some((m) => m.restaurant_id === cookieId);
          setCurrent(valid ? cookieId : list[0]?.restaurant_id || null);
          setLoading(false);
        });
    });
    return () => { active = false; };
  }, []);

  if (loading || memberships.length <= 1) return null;

  async function onChange(e) {
    const id = e.target.value;
    document.cookie = `active_restaurant_id=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setCurrent(id);
    router.refresh();
  }

  return (
    <select
      value={current || memberships[0]?.restaurant_id}
      onChange={onChange}
      className={`h-12 min-h-12 w-full max-w-full truncate rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2 text-base font-semibold ${className}`}
      aria-label="Cambiar restaurante"
    >
      {memberships.map((m) => (
        <option key={m.restaurant_id} value={m.restaurant_id}>
          {m.restaurants?.name || "Restaurante"}
        </option>
      ))}
    </select>
  );
}
