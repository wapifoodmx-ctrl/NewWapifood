"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { Icon } from "@/components/ui/Icon";

const HELP = {
  id: "ayuda",
  title: "Ayuda",
  hint: "Preguntas de la operación",
  icon: "bell",
  href: null,
};

function fold(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function CommandPalette({ open, onClose }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const items = useMemo(() => {
    const needle = fold(query.trim());
    const all = [...MODULES, HELP];
    if (!needle) return all;
    return all.filter((item) => fold(`${item.title} ${item.hint}`).includes(needle));
  }, [query]);

  const active = items.length ? Math.min(index, items.length - 1) : 0;

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function go(item) {
    if (!item) return;
    onClose();
    if (item.id === "ayuda") {
      window.dispatchEvent(new Event("wapifood-open-help"));
      return;
    }
    router.push(item.href);
  }

  function onInputKey(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((value) => (items.length ? (Math.min(value, items.length - 1) + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((value) => (items.length ? (Math.min(value, items.length - 1) - 1 + items.length) % items.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(items[active]);
    }
  }

  return (
    <div className="sheet-back cmdk-back" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmdk-title"
        className="cmdk"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cmdk-title" className="sr-only">
          Buscar una pantalla
        </h2>
        <label className="cmdk-field">
          <Icon name="search" size={22} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Ir a caja, cocina, platillos…"
            aria-controls="cmdk-list"
            aria-activedescendant={items[active] ? `cmdk-${items[active].id}` : undefined}
            aria-autocomplete="list"
          />
        </label>
        <ul id="cmdk-list" role="listbox" aria-label="Pantallas" className="cmdk-list">
          {items.map((item, itemIndex) => (
            <li key={item.id} role="presentation">
              <button
                id={`cmdk-${item.id}`}
                type="button"
                role="option"
                aria-selected={itemIndex === active}
                className={`cmdk-item ${itemIndex === active ? "is-on" : ""}`}
                onMouseEnter={() => setIndex(itemIndex)}
                onClick={() => go(item)}
              >
                <Icon name={item.icon} size={22} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            </li>
          ))}
          {!items.length ? <li className="cmdk-empty">No hay una pantalla con ese nombre. Prueba «caja» o «plan».</li> : null}
        </ul>
      </div>
    </div>
  );
}
