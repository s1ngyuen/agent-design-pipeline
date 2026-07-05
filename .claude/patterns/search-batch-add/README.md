# Pattern: Search + Batch Add

## What this provides

A search-select-stage-commit UX for adding many items from a large, static, in-bundle catalog (hundreds+ of entries) in one action: precomputed accent-normalized search index, debounced input, a staged list, and a batched commit that avoids client-cache race conditions.

## When to use it

The brief has a large, fixed dataset (a card checklist, a product catalog, anything baked into the bundle rather than paginated from a DB) where users search for entries and add several at once — not a one-at-a-time form.

## Setup steps

1. Copy `files/lib/searchIndex.example.ts`, replace `CatalogItem`/`CATALOG` with the project's real static dataset import.
2. Copy `files/components/SearchInput.example.tsx` and `files/hooks/useBatchAdd.example.ts`, point `useBatchAdd` at the project's real "owned/collected" API endpoint (pairs naturally with the database-neon-drizzle pattern's `items` PATCH route — adapt the body shape to match).

## Lessons Learned

- **A naive search over a large static array — `.filter()` + `.toLowerCase()` on every keystroke — causes real, perceptible typing lag once the array is in the hundreds.** The fix isn't a search vendor, it's precomputing a lowercase (and accent-normalized) index once at module load and debouncing the input handler (~150ms), which is what `searchIndex.example.ts` does. Also normalize accents/diacritics — a real bug meant typing "Di Maria" didn't find "Ángel Di María" because the search only did plain substring matching with no normalization.
- **Search should support prefix/category matching for sub-groups, not just exact/substring name matching.** A real improvement here let users type a category prefix (e.g. "DB") to list every item in that sub-category by ID, in addition to name search — small addition, meaningfully better UX for datasets with sub-groups.
- **Calling an individual add-and-revalidate function in a loop for a batch action causes real SWR/client-cache race conditions.** The revalidation (GET refetch) for item N can land after item N+1's optimistic update was already written to the cache, silently overwriting it — items appear to vanish from the UI even though the server has them correctly. `useBatchAdd.example.ts`'s Lessons Learned comment walks through exactly how this happened and why the fix is: one optimistic update for the whole batch, all PATCH calls fired in parallel, one revalidation at the end — never a loop of individual add-then-revalidate calls.
