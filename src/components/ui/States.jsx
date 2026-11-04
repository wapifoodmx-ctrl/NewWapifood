"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function EmptyState({ icon = "dish", title, text, action }) {
  return (
    <div className="empty" role="status">
      <span className="empty-icon" aria-hidden="true">
        <Icon name={icon} size={32} />
      </span>
      <p className="empty-title">{title}</p>
      {text ? <p className="empty-text">{text}</p> : null}
      {action || null}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status">
      <Icon name="ban" size={22} />
      <p>
        <strong>Sin conexión.</strong> Revisa tu internet. Cuando vuelva, esta pantalla se actualiza sola.
      </p>
    </div>
  );
}
