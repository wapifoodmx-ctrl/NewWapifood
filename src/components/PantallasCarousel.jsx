'use client';

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SCREENS = [
  { id: "cocina", label: "Cocina", href: "/cocina" },
  { id: "pos", label: "Punto de venta", href: "/pos" },
  { id: "tickets", label: "Tickets", href: "/tickets" },
  { id: "dashboard", label: "Panel", href: "/dashboard" },
];

export function PantallasCarousel({ screens = SCREENS, interval = 12000 }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const count = screens.length;
  const current = screens[index];

  function go(i) {
    setIndex(((i % count) + count) % count);
  }
  function next() { go(index + 1); }
  function prev() { go(index - 1); }

  useEffect(() => {
    if (paused || count <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [paused, count, interval]);

  // Fullscreen on mount (best effort)
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-cream)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-ember)]">
          Carrusel · {current.label}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prev} className="btn-ghost px-3" aria-label="Anterior">‹</button>
          <button type="button" onClick={() => setPaused((p) => !p)} className="btn-ghost px-3" aria-label={paused ? "Reanudar" : "Pausar"}>
            {paused ? "▶" : "⏸"}
          </button>
          <button type="button" onClick={next} className="btn-ghost px-3" aria-label="Siguiente">›</button>
          <button type="button" onClick={() => router.push("/pantallas")} className="btn-ghost px-3" aria-label="Salir">✕</button>
        </div>
      </div>
      {/* Dots */}
      <div className="flex justify-center gap-2 py-2">
        {screens.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            className={`h-2 w-2 rounded-full ${i === index ? "bg-[var(--color-ember)]" : "bg-[var(--color-line)]"}`}
            aria-label={s.label}
          />
        ))}
      </div>
      {/* Frame */}
      <div className="relative flex-1 overflow-hidden">
        <iframe
          key={current.id}
          src={current.href}
          title={current.label}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
