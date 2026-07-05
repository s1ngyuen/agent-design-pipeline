'use client';
import useSWR from 'swr';

export interface Item {
  id: string;
  user_id: string;
  title: string;
  data: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Debounce helper — coalesces rapid edits into one request instead of one
// PATCH per keystroke/click. See pattern README "Lessons Learned".
function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function useItems() {
  const { data, error, mutate } = useSWR<Item[]>('/api/items', fetcher);

  /**
   * Update a single item optimistically, with a trailing debounce and
   * optimistic-concurrency conflict handling. On 409, refetch server truth
   * and surface a conflict message rather than silently overwriting.
   */
  const debouncedPersist = debounce(
    async (id: string, expectedVersion: number, patch: { title?: string; data?: Record<string, unknown> }) => {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion, ...patch }),
      });

      if (res.status === 409) {
        await mutate(); // refetch — our optimistic view was stale
        throw new Error('conflict');
      }
      if (!res.ok) throw new Error('update failed');

      await mutate();
    },
    300,
  );

  function updateItem(id: string, patch: { title?: string; data?: Record<string, unknown> }) {
    const current = data?.find(i => i.id === id);
    if (!current) return;

    // Optimistic update, applied immediately
    mutate(
      (prev = []) => prev.map(i => (i.id === id ? { ...i, ...patch } : i)),
      false,
    );

    debouncedPersist(id, current.version, patch);
  }

  return {
    items: data ?? [],
    isLoading: !data && !error,
    error,
    updateItem,
    refresh: () => mutate(),
  };
}
