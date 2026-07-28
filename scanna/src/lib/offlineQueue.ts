"use client";

// IndexedDB-backed outbox for offline manual-entry writes, per plan.md §6
// "PWA — concrete caching and offline-queue behaviour": a custom outbox
// rather than the Background Sync API, because Background Sync has no
// Safari/iOS PWA support and iOS is a realistic device for this app's
// shop/show use case.
//
// Only queues writes that don't depend on a live third-party call succeeding
// (fully manual-entry POST /api/cards, PATCH /api/cards/[id], POST
// /api/sales). Recognition (/api/recognize/*) and valuation (/api/estimate)
// are never queued — they genuinely cannot succeed offline, so Scan/Research
// disable those actions outright instead (see ScanPage/ResearchPage).

import { openDB, type IDBPDatabase } from "idb";

export interface QueuedMutation {
  id: string; // client-generated idempotency key
  method: "POST" | "PATCH";
  url: string;
  body: unknown;
  kind: "card" | "card-patch" | "sale";
  label: string; // human-readable, for the pending-queue indicator
  createdAt: number;
}

const DB_NAME = "scanna-offline";
const DB_VERSION = 1;
const STORE = "outbox";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueMutation(mutation: Omit<QueuedMutation, "id" | "createdAt">): Promise<QueuedMutation> {
  const full: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const db = await getDb();
  await db.put(STORE, full);
  return full;
}

export async function listQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as QueuedMutation[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueuedMutation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

/** Replays every queued mutation in order. Stops at the first failure that
 * isn't a plain network error (e.g. a 4xx from the server) so a bad payload
 * doesn't retry forever — that item stays queued and is surfaced for manual
 * review rather than silently dropped. */
export async function replayQueue(): Promise<{ succeeded: number; failed: number }> {
  const queued = await listQueuedMutations();
  let succeeded = 0;
  let failed = 0;

  for (const mutation of queued) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.body),
      });
      if (res.ok) {
        await removeQueuedMutation(mutation.id);
        succeeded += 1;
      } else if (res.status >= 400 && res.status < 500) {
        // Won't succeed on retry without user intervention — leave queued,
        // but don't block replay of the remaining items.
        failed += 1;
      } else {
        // Server/network trouble — stop here, try again next reconnect.
        break;
      }
    } catch {
      // Still offline / request failed — stop, retry later.
      break;
    }
  }

  return { succeeded, failed };
}
