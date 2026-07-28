"use client";

import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useToast } from "@/components/ui/Toast";
import { WifiOffIcon, CheckIcon } from "@/components/ui/icons";

// How long the "synced" confirmation stays visible in the banner itself
// after a reconnect sync completes — long enough to notice even if the
// transient toast (content.md's "Back online. {n} synced.") gets missed or
// the user's already navigated away from wherever the toast rendered.
const SYNCED_VISIBLE_MS = 6000;

/** Global offline/sync-status banner — shown whenever useOnlineStatus is
 * false, and briefly again right after a reconnect sync completes. Copy for
 * the offline states is verbatim from content.md "Offline Banner". Also
 * owns replaying the IndexedDB outbox on reconnect and firing the "Back
 * online" toast — the toast is transient and easy to miss, so this
 * component itself also holds a "just synced" state for a few seconds as a
 * persistent, harder-to-miss confirmation that queued cards actually made
 * it to the server (not just "an event fired somewhere"). */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { showToast } = useToast();
  const [justSynced, setJustSynced] = useState<number | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { pendingCount } = useOfflineQueue((n) => {
    showToast(`Back online. ${n} card${n === 1 ? "" : "s"} synced.`, "success");
    setJustSynced(n);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setJustSynced(null), SYNCED_VISIBLE_MS);
  });

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  if (online && justSynced == null) return null;

  if (online && justSynced != null) {
    return (
      <div
        role="status"
        className="sticky top-0 z-30 flex items-start gap-3 border-b border-gold-dark/30 bg-gold-soft px-4 py-3 text-ink"
      >
        <CheckIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">Back online</p>
          <p>
            {justSynced} card{justSynced === 1 ? "" : "s"} synced — everything you saved offline has made it to
            your Collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex items-start gap-3 border-b border-gold-dark/30 bg-gold-soft px-4 py-3 text-ink"
    >
      <WifiOffIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">You&apos;re offline</p>
        {pendingCount > 0 ? (
          <p>
            {pendingCount} card{pendingCount === 1 ? "" : "s"} saved offline and waiting to sync. They&apos;ll
            upload automatically as soon as you&apos;re back online — nothing is lost.
          </p>
        ) : (
          <p>
            Recognition and value estimates need a live connection, so those are paused for now. Manual entry
            still works — your TCDB checklists are cached, and anything you save will sync the moment
            you&apos;re back online.
          </p>
        )}
      </div>
    </div>
  );
}
