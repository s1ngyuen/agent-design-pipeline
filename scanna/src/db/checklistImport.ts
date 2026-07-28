// Import logic for `src/db/checklist-data/*.json` — real per-product
// checklist reference data (see schema.ts's checklist_cards comment for
// what this is and why it exists). Shared between the CLI script
// (db:import-checklist, for local/dev databases) and the one-off
// `/api/admin/checklist/import` route (for production, where
// DATABASE_URL/DIRECT_URL are Sensitive Vercel env vars unreadable outside
// the running app — same constraint documented in seedInventory.ts).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb, schema } from './index';

export interface ChecklistRow {
  sport: 'NFL' | 'NBA' | 'UFC' | 'Soccer';
  year: string;
  manufacturer: string;
  product: string;
  subset: string;
  card_number: string | null;
  player: string;
  team: string | null;
  parallel_name: string | null;
  print_run: string | null;
  is_auto: boolean;
  is_rookie: boolean;
  source_url: string | null;
}

const DATA_DIR = join(__dirname, 'checklist-data');

export function loadChecklistFiles(): { file: string; rows: ChecklistRow[] }[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  return files.map((file) => ({
    file,
    rows: JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8')),
  }));
}

/**
 * Bulk-inserts checklist rows, skipping any that collide with an
 * already-imported row (product+subset+card_number+player, per the unique
 * index in schema.ts) — safe to re-run against the same file without
 * creating duplicates. Returns exactly how many rows were newly inserted vs
 * skipped as pre-existing, via Postgres's own RETURNING (not a before/after
 * count, which would race against concurrent writes).
 */
export async function importChecklistRows(
  rows: ChecklistRow[],
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const db = getDb();
  const CHUNK_SIZE = 500; // stay well under Postgres's per-statement param limit
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await db
      .insert(schema.checklistCards)
      .values(chunk)
      .onConflictDoNothing({
        target: [
          schema.checklistCards.product,
          schema.checklistCards.subset,
          schema.checklistCards.card_number,
          schema.checklistCards.player,
        ],
      })
      .returning({ id: schema.checklistCards.id });
    inserted += result.length;
  }

  return { inserted, skipped: rows.length - inserted };
}
