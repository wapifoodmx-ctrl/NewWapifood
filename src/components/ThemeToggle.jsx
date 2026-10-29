"use client";

import { useId, useSyncExternalStore } from "react";

// Sol/luna con máscara: mismo dibujo que el variant "sun-moon" de SmoothUI,
// sin motion/lucide (transiciones CSS en su lugar).
const MASK = { light: { cx: 38, cy: 4, r: 9 }, dark: { cx: 17.6, cy: 8, r: 8.6 } };
const DISC = { light: 5, dark: 8.2 };
const ROTATION = { light: 0, dark: 60 };
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];
const RAY_INNER = 7.3;
const RAY_OUTER = 10.3;
const EASE = { transition: "all .35s cubic-bezier(.23,1,.32,1)" };

// El tema lo fija el script de layout.js antes del primer pintado; aquí solo se lee.
const getTheme = () => (document.documentElement.classList.contains("dark") ? "dark" : "light");

function subscribe(onChange) {
  window.addEventListener("themechange", onChange);
  return () => window.removeEventListener("themechange", onChange);
}

export default function ThemeToggle({ className = "" }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  const maskId = `theme-toggle-${useId().replace(/:/g, "")}`;
  const dark = theme === "dark";
  const mask = MASK[theme];

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage bloqueado (modo privado): el tema dura lo que la sesión.
    }
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Activar tema claro" : "Activar tema oscuro"}
      title={dark ? "Tema claro" : "Tema oscuro"}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ember)] print:hidden ${className}`}
    >
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        className={`transition-colors duration-300 ${dark ? "text-indigo-400" : "text-amber-500"}`}
      >
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <circle cx={mask.cx} cy={mask.cy} r={mask.r} fill="black" style={EASE} />
        </mask>

        <circle cx="12" cy="12" r={DISC[theme]} fill="currentColor" mask={`url(#${maskId})`} style={EASE} />

        <g
          style={{
            ...EASE,
            transformBox: "view-box",
            transformOrigin: "12px 12px",
            transform: `rotate(${ROTATION[theme]}deg)`,
          }}
        >
          {RAYS.map((angle, index) => {
            const radians = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={12 + Math.cos(radians) * RAY_INNER}
                x2={12 + Math.cos(radians) * RAY_OUTER}
                y1={12 + Math.sin(radians) * RAY_INNER}
                y2={12 + Math.sin(radians) * RAY_OUTER}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                style={{
                  ...EASE,
                  transformBox: "view-box",
                  transformOrigin: "12px 12px",
                  transform: dark ? "scale(.12)" : "scale(1)",
                  opacity: dark ? 0 : 1,
                  transitionDelay: `${index * 0.025}s`,
                }}
              />
            );
          })}
        </g>
      </svg>
    </button>
  );
}
