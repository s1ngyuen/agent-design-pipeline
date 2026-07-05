'use client';
import useSWR from 'swr';

export interface OwnedMap {
  [itemId: string]: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

/**
 * Lessons Learned: an earlier version of this called an individual
 * add-and-revalidate function in a loop for batch operations. Each call's
 * GET revalidation could land after the NEXT item's optimistic update was
 * already written, silently overwriting it in the cache — items appeared to
 * "disappear" from the UI even though the server had them correctly. Fix:
 * ONE optimistic update covering the whole batch, all writes in parallel,
 * ONE revalidation at the end.
 */
export function useBatchAdd() {
  const { data, mutate } = useSWR<OwnedMap>('/api/owned', fetcher);

  async function batchAdd(itemIds: string[]): Promise<{ failed: number }> {
    const updates: OwnedMap = {};
    for (const id of itemIds) {
      const base = data?.[id] ?? 0;
      updates[id] = (updates[id] ?? base) + 1;
    }

    // Single optimistic update — not one per item
    await mutate({ ...(data ?? {}), ...updates }, false);

    // All writes fired in parallel — not sequentially in a loop
    let failed = 0;
    await Promise.all(
      Object.entries(updates).map(async ([itemId, count]) => {
        try {
          const res = await fetch('/api/owned', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, count }),
          });
          if (!res.ok) failed++;
        } catch {
          failed++;
        }
      }),
    );

    // Single revalidation to sync with server truth — not one per item
    await mutate();

    return { failed };
  }

  return { owned: data ?? {}, batchAdd };
}
