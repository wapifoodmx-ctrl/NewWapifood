"use client";

import { useEffect, useState } from "react";
import { AIChatCard } from "@/components/AIChatCard";
import { HELP_SUGGESTIONS, answerHelp } from "@/lib/helpAnswers";

export function HelpChat({ lift = "" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function openHelp() {
      setOpen(true);
    }
    window.addEventListener("wapifood-open-help", openHelp);
    return () => window.removeEventListener("wapifood-open-help", openHelp);
  }, []);

  return (
    <div className={`help-dock fixed z-[1400] ${lift === "high" ? "help-dock-high" : ""}`}>
      {open ? (
        <div className="mb-2 h-[420px] w-[min(100vw-2rem,22rem)]">
          <AIChatCard
            title="Ayuda"
            subtitle="Pregunta sobre caja, cocina, carta o inventario."
            greeting="¿En qué te ayudo?"
            prompt={HELP_SUGGESTIONS[0]}
            prompts={HELP_SUGGESTIONS}
            autoType
            placeholder="Escribe tu pregunta…"
            onSend={(q) => answerHelp(q)}
            onReset={() => setOpen(false)}
          />
        </div>
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
