// Seed script — parses the user's inventory spreadsheet into `cards`
// (+ a matching `ebay_listings` row for every `Listed: Yes` row, per
// plan.md's Phase 0 task 4) and imports it for a single target user.
//
// The real 23-row spreadsheet (brief.md's "user's existing 23-row
// spreadsheet of inventory") has since been provided and lives at
// `src/db/seed-data/inventory.json` — this script uses it automatically
// whenever it's present. `seed-data/inventory.sample.json` (3 rows, each
// tagged as a placeholder in its `notes` field) is kept only as a fallback
// for environments where the real file hasn't been dropped in yet (e.g. a
// fresh clone before running the import step).
//
// Usage: npm run db:seed
// Requires SEED_USER_EMAIL (or SEED_USER_ID) env var pointing at an
// existing row in `users` — that row is created by NextAuth on first
// Google sign-in, so sign in once via the app before seeding. This script
// deliberately does not create a user row itself: `users` is owned by the
// auth pattern (@auth/drizzle-adapter), not by this seed data.

import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, schema } from './index';

interface SeedRow {
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

function loadSeedRows(): { rows: SeedRow[]; source: string } {
  const realDataPath = join(__dirname, 'seed-data', 'inventory.json');
  if (existsSync(realDataPath)) {
    return { rows: JSON.parse(readFileSync(realDataPath, 'utf-8')), source: realDataPath };
  }
  const samplePath = join(__dirname, 'seed-data', 'inventory.sample.json');
  return { rows: JSON.parse(readFileSync(samplePath, 'utf-8')), source: samplePath };
}

async function resolveTargetUserId(): Promise<string> {
  const db = getDb();
  const email = process.env.SEED_USER_EMAIL;
  const explicitId = process.env.SEED_USER_ID;

  if (explicitId) return explicitId;

  if (email) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (!user) {
      throw new Error(
        `No user found with email "${email}". Sign in via Google OAuth once first (users are created on first sign-in), then re-run db:seed.`,
      );
    }
    return user.id;
  }

  const [firstUser] = await db.select().from(schema.users).limit(1);
  if (!firstUser) {
    throw new Error(
      'No users exist yet — sign in via Google OAuth once first, or set SEED_USER_EMAIL/SEED_USER_ID, then re-run db:seed.',
    );
  }
  return firstUser.id;
}

async function main(): Promise<void> {
  const db = getDb();
  const { rows, source } = loadSeedRows();
  const usingSampleData = source.endsWith('inventory.sample.json');

  if (usingSampleData) {
    console.warn(
      '⚠️  Seeding with 3 placeholder sample rows (brief.md), not the real 23-row spreadsheet — ' +
        'the real file was not provided. Drop it in at src/db/seed-data/inventory.json to seed the real data.',
    );
  }

  const userId = await resolveTargetUserId();
  console.log(`Seeding ${rows.length} card(s) for user ${userId} (source: ${source})`);

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

  console.log(`Done: ${cardsCreated} card(s), ${listingsCreated} eBay listing(s) created.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
