"use client";

import { useEffect } from "react";

/** Registers /sw.js on mount (production only — skip in dev so hot reload
 * isn't fighting a stale-while-revalidate cache). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure shouldn't break the app — it just means no
      // offline app-shell caching this session.
    });
  }, []);

  return null;
}
