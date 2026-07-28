"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { syncEbayListings } from "@/hooks/useEbayListings";
import { ApiError } from "@/lib/api";

export function SyncButton({ onSynced }: { onSynced: () => void }) {
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const { synced } = await syncEbayListings();
      showToast(`Listings updated — ${synced} synced.`, "success");
      onSynced();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 428
          ? "Connect your eBay account to sync listings."
          : "Couldn't reach eBay to sync. Your listings still show their last-known status.";
      showToast(message, "error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleSync} loading={syncing}>
      {syncing ? "Syncing with eBay..." : "Sync Now"}
    </Button>
  );
}
