"use client";

import { useEffect, useState } from "react";
import { HELP_SUGGESTIONS, answerHelp } from "@/lib/helpAnswers";

export function HelpChat({ lift = "" }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: "Pregunta sobre caja, cocina, carta o inventario." },
  ]);

  useEffect(() => {
    function openHelp() {
      setOpen(true);
    }
    window.addEventListener("wapifood-open-help", openHelp);
    return () => window.removeEventListener("wapifood-open-help", openHelp);
  }, []);

  function ask(value) {
    const q = value.trim();
    if (!q) return;
    setMessages((list) => [...list, { role: "user", text: q }, { role: "bot", text: answerHelp(q) }]);
    setText("");
  }

  return (
    <div className={`help-dock fixed z-[1400] ${lift === "high" ? "help-dock-high" : ""}`}>
      {open ? (
        <section className="mb-2 flex h-[420px] w-[min(100vw-2rem,22rem)] flex-col border border-[var(--color-warm-stone)] bg-[var(--color-paper)] shadow-xl" aria-label="Ayuda">
          <header className="flex items-center justify-between border-b border-[var(--color-warm-stone)] px-3 py-2">
            <h2 className="text-lg font-normal">Ayuda</h2>
            <button type="button" className="text-xs font-semibold uppercase" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {messages.map((m, i) => (
              <p key={i} className={m.role === "user" ? "text-right font-semibold" : "text-[var(--color-espresso)]"}>
                {m.text}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 px-3">
            {HELP_SUGGESTIONS.map((q) => (
              <button key={q} type="button" className="text-left text-[11px] underline" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <label className="sr-only" htmlFor="help-q">Pregunta</label>
            <input
              id="help-q"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-11 min-w-0 flex-1 border border-[var(--color-warm-stone)] bg-[var(--color-parchment)] px-2"
            />
            <button type="submit" className="h-11 bg-[var(--color-onyx-warm)] px-3 text-xs font-semibold uppercase text-[var(--color-parchment)]">
              Enviar
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="h-12 rounded-[3px] bg-[var(--color-onyx-warm)] px-4 text-xs font-semibold uppercase text-[var(--color-parchment)]"
        onClick={() => setOpen((v) => !v)}
      >
        Ayuda
      </button>
    </div>
  );
}
