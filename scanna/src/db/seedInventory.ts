// Shared insert logic for `src/db/seed-data/inventory.json`, used by both
// the CLI script (seed.ts, for local/dev databases where DATABASE_URL is a
// plain readable env var) and the one-off `/api/admin/seed` route (for the
// production database, where DATABASE_URL is a "Sensitive" Vercel env var —
// readable only at runtime inside the deployed app, never via `vercel env
// pull`/CLI/dashboard — so seeding production data has to happen through a
// request the app itself handles, not a local script).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb, schema } from './index';

export interface SeedRow {
  sport: 'NFL' | 'NBA' | 'UFC' | 'Soccer';
  league: string | null;
  player: string;
  team: string;
  year: string;
  manufacturer: string;
  product: string;
  card_number: string;
  parallel_name: string | null;
  print_run: number | null;
  is_auto: boolean;
  is_rookie: boolean;
  condition: 'Mint' | 'Excellent' | 'Good' | 'Poor';
  grade: number | null;
  grader: 'PSA' | 'BGS' | 'SGC' | 'None' | null;
  acquisition_price: number;
  acquisition_date: string;
  listed: boolean;
  start_price: number | null;
  buy_now_price: number | null;
  notes: string | null;
}

export function loadSeedRows(): { rows: SeedRow[]; source: string } {
  const realDataPath = join(__dirname, 'seed-data', 'inventory.json');
  if (existsSync(realDataPath)) {
    return { rows: JSON.parse(readFileSync(realDataPath, 'utf-8')), source: realDataPath };
  }
  const samplePath = join(__dirname, 'seed-data', 'inventory.sample.json');
  return { rows: JSON.parse(readFileSync(samplePath, 'utf-8')), source: samplePath };
}

export async function seedInventoryForUser(
  userId: string,
  rows: SeedRow[],
): Promise<{ cardsCreated: number; listingsCreated: number }> {
  const db = getDb();
  let cardsCreated = 0;
  let listingsCreated = 0;

  for (const row of rows) {
    const [card] = await db
      .insert(schema.cards)
      .values({
        user_id: userId,
        sport: row.sport,
        league: row.league,
        player: row.player,
        team: row.team,
        year: row.year,
        manufacturer: row.manufacturer,
        product: row.product,
        card_number: row.card_number,
        parallel_name: row.parallel_name,
        print_run: row.print_run,
        is_auto: row.is_auto,
        is_rookie: row.is_rookie,
        condition: row.condition,
        grade: row.grade != null ? String(row.grade) : null,
        grader: row.grader,
        photos: [],
        acquisition_price: String(row.acquisition_price),
        acquisition_date: row.acquisition_date,
        // Estimated value is intentionally left null — seed data hasn't
        // been through the Claude estimation pipeline (no fabricated
        // estimate), and cards.status reflects Listed: Yes/No from the sheet.
        status: row.listed ? 'listed' : 'in-stock',
        notes: row.notes,
      })
      .returning();
    cardsCreated++;

    if (row.listed) {
      // Historical listing backfilled from the spreadsheet, not created
      // through our own draft/publish flow — so there's no real
      // ebay_offer_id/ebay_listing_id to store. Status is 'active' because
      // the sheet says it's currently listed; this is a backfill, not a
      // simulation of the draft->publish gate.
      await db.insert(schema.ebayListings).values({
        card_id: card.id,
        title: `${row.year} ${row.manufacturer} ${row.product} ${row.player} ${row.card_number}${row.parallel_name ? ` ${row.parallel_name}` : ''}`,
        start_price: row.start_price != null ? String(row.start_price) : null,
        buy_now_price: row.buy_now_price != null ? String(row.buy_now_price) : null,
        status: 'active',
      });
      listingsCreated++;
    }
  }

  return { cardsCreated, listingsCreated };
}
