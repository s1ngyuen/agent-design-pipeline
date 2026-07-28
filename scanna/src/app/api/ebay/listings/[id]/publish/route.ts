import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { getValidAccessToken, EbayNotConnectedError } from '@/lib/ebay/auth';
import { publishOffer } from '@/lib/ebay/offerApi';
import { EbayApiError } from '@/lib/ebay/config';

// ── POST /api/ebay/listings/[id]/publish ─────────────────────────────────
// THE ONLY route in this codebase that calls publishOffer() — per
// plan.md §6 "eBay Integration", this is a hard requirement, not a
// preference. Draft creation (POST /api/ebay/listings) calls createOffer()
// only and stops. This route makes the listing live on eBay; it is only
// ever triggered by an explicit user action (PublishListingButton +
// confirmation dialog, per the frontend plan) — never automatically.
const bodySchema = z.object({
  expectedVersion: z.number().int(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const [existing] = await getDb()
    .select({ listing: schema.ebayListings, user_id: schema.cards.user_id })
    .from(schema.ebayListings)
    .innerJoin(schema.cards, eq(schema.ebayListings.card_id, schema.cards.id))
    .where(eq(schema.ebayListings.id, id));

  if (!existing || existing.user_id !== session.user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (existing.listing.status !== 'draft') {
    return NextResponse.json(
      { error: 'not_draft', message: 'Only a draft listing can be published' },
      { status: 400 },
    );
  }
  if (existing.listing.version !== parsed.data.expectedVersion) {
    return NextResponse.json(
      { error: 'conflict', message: 'Listing was modified by another request' },
      { status: 409 },
    );
  }
  if (!existing.listing.ebay_offer_id) {
    return NextResponse.json(
      { error: 'no_offer', message: 'This listing has no eBay offer to publish' },
      { status: 400 },
    );
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

  try {
    const published = await publishOffer(accessToken, existing.listing.ebay_offer_id);

    const [updated] = await getDb()
      .update(schema.ebayListings)
      .set({
        ebay_listing_id: published.listingId,
        status: 'active',
        listed_date: sql`now()`,
        version: sql`${schema.ebayListings.version} + 1`,
        updated_at: sql`now()`,
      })
      .where(and(eq(schema.ebayListings.id, id), eq(schema.ebayListings.version, parsed.data.expectedVersion)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'conflict', message: 'Listing was modified by another request' },
        { status: 409 },
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof EbayApiError) {
      console.error('eBay publish failed:', err.status, err.message);
      return NextResponse.json({ error: 'ebay_api_error', message: err.message }, { status: 502 });
    }
    throw err;
  }
}
