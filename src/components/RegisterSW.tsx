"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker (production only, since dev HMR conflicts with SW caching),
 * shows an offline banner, and offers a reload when a new app version has taken over.
 */
export function RegisterSW() {
  const [offline, setOffline] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const onChange = () => hadController && setUpdated(true);
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => reg.update().catch(() => undefined))
        .catch((e) => console.warn("SW registration failed", e));
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      };
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline && !updated) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm shadow-lg">
        {offline ? (
          <span>
            <strong className="text-warn">Offline.</strong> <span className="text-muted">Edits are kept on this device and sync when you reconnect.</span>
          </span>
        ) : (
          <>
            <span>A new version of the app is available.</span>
            <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
              Reload
            </button>
          </>
        )}
      </div>
    </div>
  );
}
