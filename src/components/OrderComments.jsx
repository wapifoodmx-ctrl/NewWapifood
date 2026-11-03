"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMissingRelation } from "@/lib/schema";
import { toast } from "@/components/ui/Toast";

export function OrderComments({ orderId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(true);

  useEffect(() => {
    let cancel = false;
    const kick = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("order_comments")
        .select("id,body,author_name,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (cancel) return;
      if (error) {
        if (isMissingRelation(error)) setReady(false);
        return;
      }
      setComments(data || []);
    }, 0);
    return () => {
      cancel = true;
      clearTimeout(kick);
    };
  }, [orderId]);

  if (!ready) return null;

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("order_comments")
      .insert({ order_id: orderId, body, author_name: "Local" })
      .select("id,body,author_name,created_at")
      .single();
    if (error) {
      if (isMissingRelation(error)) {
        setReady(false);
        return;
      }
      toast.error(error.message);
      return;
    }
    setComments((list) => [...list, data]);
    setText("");
  }

  return (
    <section className="mt-3 border-t border-[var(--color-warm-stone)] pt-3">
      <h3 className="text-xs font-semibold uppercase text-[var(--color-walnut)]">Comentarios</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {comments.map((c) => (
          <li key={c.id}>
            <span className="font-semibold">{c.author_name || "Nota"}:</span> {c.body}
          </li>
        ))}
        {!comments.length ? <li className="text-[var(--color-walnut)]">Sin comentarios.</li> : null}
      </ul>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor={`c-${orderId}`}>Comentario</label>
        <input
          id={`c-${orderId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nota de la orden"
          className="h-10 min-w-0 flex-1 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
        />
        <button type="submit" className="h-10 px-3 text-xs font-semibold uppercase">
          Guardar
        </button>
      </form>
    </section>
  );
}
