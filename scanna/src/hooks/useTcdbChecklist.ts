"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { ApiError, apiFetch } from "@/lib/api";
import {
  cacheChecklist,
  getCachedChecklist,
  searchChecklist,
  type TcdbChecklistEntry,
  type TcdbSport,
} from "@/lib/tcdb/searchIndex";
import { useOnlineStatus } from "./useOnlineStatus";

export type TcdbChecklistStatus =
  | "loading"
  | "ready" // live data
  | "offline-cache" // serving a cached copy while offline
  | "unavailable" // TCDB not configured server-side (501) — fall back to free text
  | "error"; // genuine failure with no cache to fall back to

interface ChecklistResult {
  entries: TcdbChecklistEntry[];
  status: TcdbChecklistStatus;
  cachedAt: number | null;
}

async function loadChecklist(sport: TcdbSport, online: boolean): Promise<ChecklistResult> {
  if (!online) {
    const cached = await getCachedChecklist(sport);
    return cached
      ? { entries: cached.entries, status: "offline-cache", cachedAt: cached.cachedAt }
      : { entries: [], status: "error", cachedAt: null };
  }

  try {
    const data = await apiFetch<TcdbChecklistEntry[]>(`/api/tcdb/checklist?sport=${sport}`);
    void cacheChecklist(sport, data);
    return { entries: data, status: "ready", cachedAt: Date.now() };
  } catch (err) {
    if (err instanceof ApiError && err.status === 501) {
      return { entries: [], status: "unavailable", cachedAt: null };
    }
    const cached = await getCachedChecklist(sport);
    return cached
      ? { entries: cached.entries, status: "offline-cache", cachedAt: cached.cachedAt }
      : { entries: [], status: "error", cachedAt: null };
  }
}

/**
 * Loads the TCDB checklist for NFL/NBA, handling the "TCDB is currently
 * stubbed/unconfigured" case gracefully (per brief.md/plan.md Open
 * Questions): a 501 from the server surfaces as `status: "unavailable"` so
 * ManualCorrectionForm can fall back to free-text fields instead of
 * blocking on a checklist that doesn't exist yet. Falls back to the
 * IndexedDB-cached copy when offline, per plan.md §PWA.
 *
 * Built on SWR (like the rest of the data hooks) rather than raw
 * useEffect+useState so data loading/caching goes through one consistent,
 * already-vetted-for-render-safety mechanism.
 */
export function useTcdbChecklist(sport: TcdbSport) {
  const online = useOnlineStatus();
  const { data, mutate } = useSWR<ChecklistResult>(
    [`tcdb-checklist`, sport, online],
    () => loadChecklist(sport, online),
  );

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const status: TcdbChecklistStatus = data?.status ?? "loading";
  const cachedAt = data?.cachedAt ?? null;

  const search = useCallback(
    (field: "player" | "team" | "product", query: string) => searchChecklist(entries, field, query),
    [entries],
  );

  return { entries, status, cachedAt, search, reload: () => mutate() };
}
