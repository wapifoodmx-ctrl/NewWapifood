'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Permite cambiar de restaurante cuando el usuario pertenece a varios.
// Guarda la selección en cookie y refresca para que el servidor la use.
export function RestaurantSwitcher() {
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
      className="h-9 max-w-[10rem] truncate rounded-[3px] border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2 text-xs font-semibold"
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
