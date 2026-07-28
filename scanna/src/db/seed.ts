// Seed script — parses the user's inventory spreadsheet (see
// seedInventory.ts for the shared insert logic) and imports it for a single
// target user. Use this for local/dev databases where DATABASE_URL is a
// plain readable env var. Production seeding goes through
// `/api/admin/seed` instead — see that route's comment for why.
//
// Usage: npm run db:seed
// Requires SEED_USER_EMAIL (or SEED_USER_ID) env var pointing at an
// existing row in `users` — that row is created by NextAuth on first
// Google sign-in, so sign in once via the app before seeding. This script
// deliberately does not create a user row itself: `users` is owned by the
// auth pattern (@auth/drizzle-adapter), not by this seed data.

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb, schema } from './index';
import { loadSeedRows, seedInventoryForUser } from './seedInventory';

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

  const { cardsCreated, listingsCreated } = await seedInventoryForUser(userId, rows);
  console.log(`Done: ${cardsCreated} card(s), ${listingsCreated} eBay listing(s) created.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
