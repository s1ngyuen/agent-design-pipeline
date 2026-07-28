"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true; // assume online during SSR — avoids a flash of the offline banner before hydration
}

/** True/false online status, per plan.md §PWA — drives the disabled state on
 * Scan/Research (recognition/valuation can't work offline) and OfflineBanner.
 * Uses useSyncExternalStore (the framework-recommended way to subscribe to
 * a mutable value that lives outside React, e.g. navigator.onLine) rather
 * than useState+useEffect. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
