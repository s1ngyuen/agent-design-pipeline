"use client";

import { useEffect, useState } from "react";
import { searchChecklist, type ChecklistCardResult } from "@/lib/checklist";
import { ApiError } from "@/lib/api";

export type ChecklistSearchStatus = "idle" | "loading" | "ready" | "error";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** Debounces `query` and calls GET /api/checklist/search — kept as its own
 * hook (rather than SWR, like the rest of the app's data hooks) because the
 * query string changes on every keystroke and SWR's key-based cache isn't a
 * good fit for a fast-changing, throwaway search-as-you-type key. */
export function useChecklistSearch(query: string): {
  results: ChecklistCardResult[];
  status: ChecklistSearchStatus;
} {
  const [results, setResults] = useState<ChecklistCardResult[]>([]);
  const [status, setStatus] = useState<ChecklistSearchStatus>("idle");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const rows = await searchChecklist(trimmed);
        if (cancelled) return;
        setResults(rows);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setResults([]);
        setStatus("error");
        if (!(err instanceof ApiError)) throw err;
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, status };
}
