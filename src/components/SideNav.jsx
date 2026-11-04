"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { navModel, roleLabel } from "@/lib/modules";
import { Icon } from "@/components/ui/Icon";
import ThemeToggle from "@/components/ThemeToggle";

const RAIL_KEY = "wapifood-nav-rail";
const OPEN_KEY = "wapifood-nav-open";
const EMPTY = [];
const NAV_EVENT = "wapifood-nav";

let openCache = { raw: null, value: EMPTY };

function subscribe(onChange) {
  window.addEventListener("storage", onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

function readRail() {
  try {
    return localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}

function readOpen() {
  let raw = "[]";
  try {
    raw = localStorage.getItem(OPEN_KEY) || "[]";
  } catch {
    raw = "[]";
  }
  if (openCache.raw === raw) return openCache.value;
  let value = EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) value = parsed.filter((id) => typeof id === "string");
  } catch {
    value = EMPTY;
  }
  openCache = { raw, value };
  return value;
}

function writeOpen(ids) {
  const raw = JSON.stringify(ids);
  try {
    localStorage.setItem(OPEN_KEY, raw);
  } catch {
    /* storage bloqueado */
  }
  openCache = { raw, value: ids };
  window.dispatchEvent(new Event(NAV_EVENT));
}

function writeRail(on) {
  try {
    localStorage.setItem(RAIL_KEY, on ? "1" : "0");
  } catch {
    /* storage bloqueado */
  }
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function useNavPrefs() {
  const rail = useSyncExternalStore(subscribe, readRail, () => false);
  const open = useSyncExternalStore(subscribe, readOpen, () => EMPTY);
  const toggleRail = useCallback(() => writeRail(!readRail()), []);
  const toggleSection = useCallback((id) => {
    const current = readOpen();
    writeOpen(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);
  const ensureSection = useCallback((id) => {
    if (!id) return;
    const current = readOpen();
    if (current.includes(id)) return;
    writeOpen([...current, id]);
  }, []);
  return { rail, open, toggleRail, toggleSection, ensureSection };
}

export function SideNav({
  role,
  restaurantName,
  pathname,
  rail = false,
  openSections,
  onToggleRail,
  onToggleSection,
  onSearch,
  onSignOut,
  onNavigate,
  homeHref = "/dashboard",
  variant = "dock",
}) {
  const model = navModel(role);
  const scrollRef = useRef(null);
  const [account, setAccount] = useState(false);
  const [fly, setFly] = useState(null);
  const closeTimer = useRef(null);
  const shortcut = useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );
  const compact = variant === "dock" && rail;
  const initial = (restaurantName || "W").trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    function sync() {
      const overflow = node.scrollHeight - node.clientHeight > 8;
      const top = node.scrollTop > 6;
      const bottom = node.scrollTop + node.clientHeight < node.scrollHeight - 6;
      let fade = "none";
      if (overflow && top && bottom) fade = "both";
      else if (overflow && top) fade = "top";
      else if (overflow && bottom) fade = "bottom";
      else if (overflow) fade = "bottom";
      node.dataset.fade = fade;
    }
    sync();
    node.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [rail, openSections, role, variant]);

  useEffect(() => {
    if (!account && !fly) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        setAccount(false);
        setFly(null);
      }
    }
    function onPointer(event) {
      if (!event.target.closest?.(".side-pop, .side-account, .side-fly-btn")) {
        setAccount(false);
        setFly(null);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [account, fly]);

  function current(href) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  function openFly(id, node) {
    clearTimeout(closeTimer.current);
    const rect = node.getBoundingClientRect();
    setFly({ id, top: Math.min(rect.top, window.innerHeight - 220), left: rect.right + 8 });
  }

  function scheduleFlyClose() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFly(null), 180);
  }

  function link(item, labeled = !compact) {
    const on = current(item.href);
    return (
      <Link
        key={`${item.id}-${item.title}`}
        href={item.href}
        aria-current={on ? "page" : undefined}
        aria-label={compact ? item.title : undefined}
        title={compact ? item.title : undefined}
        className="side-link"
        onClick={() => {
          setFly(null);
          onNavigate?.();
        }}
      >
        <Icon name={item.icon} size={20} />
        {labeled ? <span className="side-label">{item.title}</span> : <span className="side-tip">{item.title}</span>}
      </Link>
    );
  }

  const groups = [
    ...model.sections,
    ...(model.more.length ? [{ id: "mas", label: "Más", icon: "list", items: model.more }] : []),
  ];

  return (
    <div className={`side-frame ${compact ? "is-rail" : ""} ${variant === "sheet" ? "is-sheet" : ""}`}>
      <div className="side-head">
        <Link href={homeHref} className="side-brand" aria-label="Inicio" onClick={onNavigate}>
          <span className="side-mark">W</span>
          {compact ? null : <span className="brand">Wapifood</span>}
        </Link>
        {variant === "dock" ? (
          <button
            type="button"
            className="side-icon-btn"
            aria-pressed={rail}
            aria-label={rail ? "Mostrar el menú con texto" : "Compactar el menú a iconos"}
            onClick={onToggleRail}
          >
            <Icon name="rail" size={20} />
          </button>
        ) : null}
      </div>

      <button type="button" className="side-link side-search" onClick={onSearch} aria-keyshortcuts="Control+K">
        <Icon name="search" size={20} />
        {compact ? <span className="side-tip">Buscar</span> : <span className="side-label">Buscar</span>}
        {compact ? null : <kbd>{shortcut}</kbd>}
      </button>

        <div className="side-pins" aria-label="Lo más usado">
        {model.pins.map((item) => link(item))}
      </div>

      <div ref={scrollRef} className="side-scroll" data-fade="none">
        {groups.map((section) => {
          const expanded = openSections.includes(section.id);
          const childOn = section.items.some((item) => current(item.href));
          if (compact) {
            return (
              <button
                key={section.id}
                type="button"
                className={`side-link side-fly-btn ${childOn ? "has-child" : ""}`}
                aria-expanded={fly?.id === section.id}
                aria-haspopup="true"
                aria-label={section.label}
                onMouseEnter={(event) => openFly(section.id, event.currentTarget)}
                onMouseLeave={scheduleFlyClose}
                onFocus={(event) => openFly(section.id, event.currentTarget)}
                onClick={(event) => openFly(section.id, event.currentTarget)}
              >
                <Icon name={section.icon} size={20} />
                <span className="side-tip">{section.label}</span>
              </button>
            );
          }
          return (
            <div key={section.id} className="side-group">
              <button
                type="button"
                className={`side-link side-section ${childOn ? "has-child" : ""}`}
                aria-expanded={expanded}
                onClick={() => onToggleSection(section.id)}
              >
                <Icon name={section.icon} size={20} />
                <span className="side-label">{section.label}</span>
                <Icon name="chevron" size={16} />
              </button>
              {expanded ? <div className="side-sub">{section.items.map((item) => link(item, true))}</div> : null}
            </div>
          );
        })}
      </div>

      {compact && fly ? (
        <div
          className="side-pop"
          style={{ top: fly.top, left: fly.left }}
          role="region"
          aria-label={groups.find((section) => section.id === fly.id)?.label}
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={scheduleFlyClose}
        >
          <p className="side-pop-title">{groups.find((section) => section.id === fly.id)?.label}</p>
          {groups
            .find((section) => section.id === fly.id)
            ?.items.map((item) => link(item, true))}
        </div>
      ) : null}

      <div className="side-foot">
        <button
          type="button"
          className="side-account"
          aria-expanded={account}
          aria-haspopup="menu"
          aria-label={`${restaurantName || "Tu restaurante"}. Abrir cuenta`}
          onClick={() => setAccount((value) => !value)}
        >
          <span className="side-avatar" aria-hidden="true">
            {initial}
          </span>
          {compact ? null : (
            <span className="side-account-text">
              <strong>{restaurantName || "Tu restaurante"}</strong>
              <small>{role ? roleLabel(role) : "Tu cuenta"}</small>
            </span>
          )}
        </button>
        <ThemeToggle />
        {account ? (
          <div className="side-pop side-account-pop" role="menu" aria-label="Cuenta">
            <p className="side-pop-title">Estás en {restaurantName || "tu restaurante"}</p>
            <button type="button" role="menuitem" className="side-link" onClick={onSignOut}>
              <Icon name="close" size={20} />
              <span className="side-label">Salir</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
