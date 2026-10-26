"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RestockButton({ ingredientId, unit }) {
  const router = useRouter();
  async function restock() {
    const supabase = createClient();
    const qty = unit === "g" || unit === "ml" ? 200 : 10;
    const { data } = await supabase.from("ingredients").select("stock").eq("id", ingredientId).single();
    await supabase
      .from("ingredients")
      .update({ stock: Number(data.stock) + qty })
      .eq("id", ingredientId);
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={restock}
      className="mt-3 h-11 rounded-xl bg-[var(--color-cream)] px-4 text-sm font-semibold"
    >
      Registrar entrada
    </button>
  );
}
