// Client-side access to GET /api/checklist/search (see that route for the
// server-side query) — real per-card reference data used to let a user
// search for a card instead of typing every field by hand.

import { apiFetch } from "@/lib/api";
import type { CardAttributes, Sport } from "@/domain/types";

export interface ChecklistCardResult {
  id: string;
  sport: Sport;
  year: string;
  manufacturer: string;
  product: string;
  subset: string;
  card_number: string | null;
  player: string;
  team: string | null;
  parallel_name: string | null;
  print_run: number | null;
  is_auto: boolean;
  is_rookie: boolean;
}

export function searchChecklist(q: string, sport?: Sport): Promise<ChecklistCardResult[]> {
  const params = new URLSearchParams({ q });
  if (sport) params.set("sport", sport);
  return apiFetch<ChecklistCardResult[]>(`/api/checklist/search?${params.toString()}`);
}

/** checklist_cards.product is stored as the full scraped string (e.g. "2025
 * Topps Finest Football" — see scripts/scrape_beckett_checklist.py's
 * product_name_from_filename()), already including the year/manufacturer
 * that are ALSO their own separate columns. Anywhere those get displayed
 * together (e.g. "{year} {manufacturer} {product}") without stripping this
 * prefix first doubles up: "2025 Topps 2025 Topps Finest Football". */
export function shortProductName(row: Pick<ChecklistCardResult, "product" | "year" | "manufacturer">): string {
  const prefix = `${row.year} ${row.manufacturer} `;
  return row.product.toLowerCase().startsWith(prefix.toLowerCase()) ? row.product.slice(prefix.length) : row.product;
}

/** Maps a matched checklist row onto the card-identity subset of
 * CardAttributes — condition/grade/grader aren't checklist data and stay
 * for the user to fill in on the Review form. `product` folds in the
 * subset name (e.g. "Finest Football Finest Autographs") so the specific
 * insert/parallel-tier the card belongs to isn't lost, since CardAttributes
 * has no separate subset field of its own. */
export function checklistResultToCardAttributes(row: ChecklistCardResult): Partial<CardAttributes> {
  const isBaseSubset = row.subset.toLowerCase() === "base";
  const product = shortProductName(row);
  return {
    sport: row.sport,
    player: row.player,
    team: row.team ?? "",
    year: row.year,
    manufacturer: row.manufacturer,
    product: isBaseSubset ? product : `${product} ${row.subset}`,
    card_number: row.card_number ?? "",
    parallel_name: row.parallel_name,
    print_run: row.print_run,
    is_auto: row.is_auto,
    is_rookie: row.is_rookie,
  };
}
