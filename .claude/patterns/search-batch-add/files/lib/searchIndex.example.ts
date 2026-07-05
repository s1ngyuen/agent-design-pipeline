// Precomputed search index over a static, in-bundle dataset (e.g. a fixed
// catalog of 100s+ of items). Built ONCE at module load — never recompute
// or re-lowercase inside a search function that runs per keystroke.
//
// Rename `CatalogItem`/`CATALOG` to the project's real static dataset.

export interface CatalogItem {
  id: string;
  name: string;
  category?: string; // e.g. a sub-group prefix like "DB" for bonus items
}

declare const CATALOG: CatalogItem[]; // import the project's real dataset here

// Strips accents/diacritics so "Di Maria" matches "Ángel Di María".
// Lesson learned: naive substring matching misses accented names entirely.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '') // strip combining diacritical marks
    .toLowerCase();
}

export const SEARCH_INDEX = CATALOG.map(item => ({
  item,
  normalizedName: normalize(item.name),
}));

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG.map(c => [c.id, c]),
);

/**
 * Exact ID lookup, then normalized exact-name match, then normalized
 * substring match, then category-prefix match (e.g. typing "DB" lists every
 * item whose id starts with "DB"). Capped and early-exits once the cap is
 * reached — never scans the full array more than once per call.
 */
export function searchCatalog(query: string, limit = 12): CatalogItem[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  if (CATALOG_BY_ID[trimmed]) return [CATALOG_BY_ID[trimmed]];

  const normalizedQuery = normalize(trimmed);

  const exact = SEARCH_INDEX.filter(e => e.normalizedName === normalizedQuery).map(e => e.item);
  if (exact.length) return exact;

  const results: CatalogItem[] = [];
  for (const entry of SEARCH_INDEX) {
    const matches =
      entry.normalizedName.includes(normalizedQuery) ||
      entry.item.id.toLowerCase().startsWith(normalizedQuery); // category-prefix match
    if (matches) {
      results.push(entry.item);
      if (results.length === limit) break;
    }
  }
  return results;
}
