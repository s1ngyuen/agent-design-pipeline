"use client";

import { useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { enqueueMutation, listQueuedMutations, replayQueue, type QueuedMutation } from "@/lib/offlineQueue";
import { useOnlineStatus } from "./useOnlineStatus";

const SWR_KEY = "offline-queue";

/** Pending-queue count + enqueue helper, per plan.md §PWA. Also replays the
 * queue automatically on the browser's `online` event / app foreground, and
 * reports how many items just synced so the caller can show the "Back
 * online. {n} synced." toast from content.md.
 *
 * Built on SWR (like the rest of the data hooks) so loading/updating state
 * is managed by SWR's own internals rather than a raw useState set from
 * inside a useEffect body. */
export function useOfflineQueue(onSynced?: (count: number) => void) {
  const online = useOnlineStatus();
  const { data, isValidating, mutate } = useSWR<QueuedMutation[]>(SWR_KEY, listQueuedMutations, {
    fallbackData: [],
  });
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    onSyncedRef.current = onSynced;
  }, [onSynced]);

  const sync = useCallback(async () => {
    await mutate(
      async () => {
        const { succeeded } = await replayQueue();
        if (succeeded > 0) onSyncedRef.current?.(succeeded);
        return listQueuedMutations();
      },
      { revalidate: false },
    );
  }, [mutate]);

  useEffect(() => {
    if (online) void sync();
    // Only re-run when connectivity flips back on, not on every `sync` identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const enqueue = useCallback(
    async (mutation: Parameters<typeof enqueueMutation>[0]) => {
      const saved = await enqueueMutation(mutation);
      await mutate();
      return saved;
    },
    [mutate],
  );

  const pending = data ?? [];
  return { pending, pendingCount: pending.length, syncing: isValidating, enqueue, refresh: () => mutate(), sync };
}
