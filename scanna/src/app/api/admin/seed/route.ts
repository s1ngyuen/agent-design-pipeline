import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { loadSeedRows, seedInventoryForUser } from '@/db/seedInventory';

// ── GET /api/admin/seed ──────────────────────────────────────────────────
// TEMPORARY, one-off route: imports the real 23-row inventory spreadsheet
// (src/db/seed-data/inventory.json) into the *signed-in* user's own account.
//
// Exists only because DATABASE_URL/DIRECT_URL are "Sensitive" Vercel env
// vars on this project — write-only after creation, unreadable via
// `vercel env pull`/CLI/dashboard by design — so the CLI seed script
// (npm run db:seed) can't reach the production database at all. This route
// runs inside the deployed app instead, where those vars are fully
// accessible at request time. GET (not POST) so it can be triggered by
// simply opening the URL in a signed-in browser tab — no client needed.
//
// Safe to call more than once: seeds only the calling user's own account
// (never an arbitrary user_id), and refuses if that user already has any
// cards, so it can't double-import. Delete this route once the one-time
// import is confirmed — it's not meant to be a permanent product feature.
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const existing = await db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(eq(schema.cards.user_id, session.user.id))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: 'already_seeded', message: 'This account already has cards — refusing to import again.' },
      { status: 409 },
    );
  }

  const { rows, source } = loadSeedRows();
  const { cardsCreated, listingsCreated } = await seedInventoryForUser(session.user.id, rows);

  return NextResponse.json({ source, cardsCreated, listingsCreated });
}
