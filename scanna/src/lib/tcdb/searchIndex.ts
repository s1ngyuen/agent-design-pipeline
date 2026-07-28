"use client";

// Client-side TCDB checklist search index — normalize/debounce/prefix-match
// technique borrowed from search-batch-add per plan.md §1a, purpose-built
// here rather than copied wholesale. Also the client half of plan.md §PWA's
// "cached for offline manual entry" behaviour: the raw checklist is written
// into IndexedDB so the same normalized index can be built whether the data
// came from a live fetch or the offline cache.

import { openDB, type IDBPDatabase } from "idb";

export interface TcdbChecklistEntry {
  player: string;
  team: string;
  year: string;
  manufacturer: string;
  product: string;
  card_number: string;
  parallel_name: string | null;
  print_run: number | null;
}

export type TcdbSport = "NFL" | "NBA";

const DB_NAME = "scanna-offline";
const DB_VERSION = 1;
const STORE = "tcdb-checklist";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no indexedDB"));
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "sport" });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheChecklist(sport: TcdbSport, entries: TcdbChecklistEntry[]): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE, { sport, entries, cachedAt: Date.now() });
  } catch {
    // IndexedDB unavailable — offline caching simply won't work this
    // session; the in-memory index still works for the current page load.
  }
}

export async function getCachedChecklist(
  sport: TcdbSport,
): Promise<{ entries: TcdbChecklistEntry[]; cachedAt: number } | null> {
  try {
    const db = await getDb();
    const row = (await db.get(STORE, sport)) as { entries: TcdbChecklistEntry[]; cachedAt: number } | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

/** Normalizes accents/case/whitespace so "Zaïre-Emery" matches "zaire emery". */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function searchChecklist(
  entries: TcdbChecklistEntry[],
  field: "player" | "team" | "product",
  query: string,
  limit = 20,
): TcdbChecklistEntry[] {
  const q = normalize(query);
  if (!q) return entries.slice(0, limit);
  const starts: TcdbChecklistEntry[] = [];
  const contains: TcdbChecklistEntry[] = [];
  for (const entry of entries) {
    const value = normalize(entry[field] ?? "");
    if (value.startsWith(q)) starts.push(entry);
    else if (value.includes(q)) contains.push(entry);
    if (starts.length + contains.length >= limit * 3) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
