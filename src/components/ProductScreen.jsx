"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/format";

const MODES = [
  { id: "single", label: "Uno" },
  { id: "classic", label: "Dos" },
  { id: "compact", label: "Compacto" },
];

export function ProductScreen({ restaurant, listName, products }) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("single");
  const [paused, setPaused] = useState(false);
  const step = mode === "single" ? 1 : 2;
  const count = products.length;

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => (current + step >= count ? 0 : current + step));
    }, 8000);
    return () => clearInterval(timer);
  }, [paused, count, step]);

  function shown() {
    if (!count) return [];
    if (mode === "single") return [products[index % count]];
    return [products[index % count], products[(index + 1) % count]].filter(Boolean);
  }

  async function fullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      await document.exitFullscreen().catch(() => {});
    }
  }

  const cards = shown();

  return (
    <main className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--primary)]">{restaurant}</p>
          <h1 className="text-2xl">{listName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? "btn-primary px-3" : "btn-ghost px-3"}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button type="button" className="btn-ghost px-3" onClick={() => setPaused((value) => !value)}>
            {paused ? "Reanudar" : "Pausa"}
          </button>
          <button type="button" className="btn-ghost px-3" onClick={fullscreen}>Pantalla completa</button>
        </div>
      </header>
      {count === 0 ? (
        <p className="m-auto max-w-md px-6 text-center text-2xl">Esta lista no tiene platillos. Agrégalos en Listas.</p>
      ) : (
        <div className={`grid flex-1 gap-4 p-4 ${cards.length > 1 ? "md:grid-cols-2" : ""}`}>
          {cards.map((product) => (
            <article key={product.id} className="flex flex-col justify-end rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-6">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt="" className="mb-4 h-64 w-full rounded-[16px] object-cover" />
              ) : null}
              <p className="text-sm font-bold uppercase tracking-wide text-[var(--primary)]">{product.category || "Destacado"}</p>
              <h2 className="mt-1 text-5xl">{product.name}</h2>
              <p className="mt-2 text-xl text-[var(--ink-soft)]">{product.description || "De la carta del local."}</p>
              <p className="mt-4 text-4xl font-extrabold">{money(product.price)}</p>
              {product.active === false ? <p className="mt-2 text-lg font-bold">No disponible</p> : <p className="mt-2 text-lg font-bold">Disponible</p>}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
