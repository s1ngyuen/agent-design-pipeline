import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { getValidAccessToken, EbayNotConnectedError } from '@/lib/ebay/auth';
import { getOffer } from '@/lib/ebay/offerApi';
import { EbayApiError } from '@/lib/ebay/config';

// ── POST /api/ebay/sync ──────────────────────────────────────────────────
// Polls status for active listings and updates status/last_synced, using
// the `version` column (bump on every write) so a concurrent user PATCH to
// the same row loses the race safely (409, caller refetches) rather than
// clobbering silently — per plan.md §6 "eBay Integration".
//
// Known gap: the Sell Inventory/Offer API (the API family this project
// uses, per brief.md) does not expose view/watcher counts — those live on
// the older Trading API's GetItem call or the Analytics/Traffic Report API,
// neither of which is in the brief's chosen API set ("Inventory + Offer +
// Taxonomy"). views/watchers are left untouched here; flagged rather than
// fabricated. Revisit if the brief's API scope is extended.
const bodySchema = z.object({
  listing_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(session.user.id);
  } catch (err) {
    if (err instanceof EbayNotConnectedError) {
      return NextResponse.json({ error: 'ebay_not_connected', message: err.message }, { status: 428 });
    }
    throw err;
  }

  const conditions = [eq(schema.cards.user_id, session.user.id), eq(schema.ebayListings.status, 'active')];
  if (parsed.data.listing_ids?.length) {
    conditions.push(inArray(schema.ebayListings.id, parsed.data.listing_ids));
  }

  const activeListings = await getDb()
    .select({ listing: schema.ebayListings })
    .from(schema.ebayListings)
    .innerJoin(schema.cards, eq(schema.ebayListings.card_id, schema.cards.id))
    .where(and(...conditions));

  // Batched with bounded concurrency rather than a fully-serial for...of —
  // at current scale a sequential loop is fine, but this avoids an
  // easy-to-hit N+1-style latency cliff as the number of active listings
  // grows, while still respecting eBay's rate limits by capping how many
  // getOffer() calls are in flight at once.
  const CONCURRENCY = 5;
  const syncable = activeListings.filter(({ listing }) => listing.ebay_offer_id);
  const results: Array<Record<string, unknown>> = [];

  async function syncOne(listing: (typeof syncable)[number]['listing']): Promise<Record<string, unknown>> {
    try {
      const offer = await getOffer(accessToken, listing.ebay_offer_id!);
      const newStatus = offer.status === 'ENDED' || offer.status === 'ENDED_WITH_SALES' ? 'sold' : offer.status === 'ENDED_WITHOUT_SALES' ? 'ended-unsold' : 'active';

      const [updated] = await getDb()
        .update(schema.ebayListings)
        .set({
          status: newStatus,
          last_synced: sql`now()`,
          version: sql`${schema.ebayListings.version} + 1`,
          updated_at: sql`now()`,
        })
        .where(and(eq(schema.ebayListings.id, listing.id), eq(schema.ebayListings.version, listing.version)))
        .returning();

      return updated ?? { id: listing.id, conflict: true };
    } catch (err) {
      if (err instanceof EbayApiError) {
        console.error(`eBay sync failed for listing ${listing.id}:`, err.status, err.message);
        return { id: listing.id, error: 'ebay_api_error' };
      }
      throw err;
    }
  }

  for (let i = 0; i < syncable.length; i += CONCURRENCY) {
    const chunk = syncable.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(({ listing }) => syncOne(listing)));
    results.push(...chunkResults);
  }

  return NextResponse.json({ synced: results.length, results });
}
