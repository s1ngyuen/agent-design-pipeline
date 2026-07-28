import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { getValidAccessToken, EbayNotConnectedError } from '@/lib/ebay/auth';
import { createOrReplaceInventoryItem } from '@/lib/ebay/inventoryApi';
import { createOffer } from '@/lib/ebay/offerApi';
import { EbayApiError } from '@/lib/ebay/config';

// ── GET /api/ebay/listings ───────────────────────────────────────────────
// Tracked listings from our DB (not a live eBay call per page load — see
// plan.md's EBayListingsPage note; use POST /api/ebay/sync to refresh).
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await getDb()
    .select({ listing: schema.ebayListings, card_id: schema.cards.id, card_player: schema.cards.player })
    .from(schema.ebayListings)
    .innerJoin(schema.cards, eq(schema.ebayListings.card_id, schema.cards.id))
    .where(eq(schema.cards.user_id, session.user.id))
    .orderBy(desc(schema.ebayListings.created_at));

  return NextResponse.json(rows.map((r) => ({ ...r.listing, card_player: r.card_player })));
}

// ── POST /api/ebay/listings ──────────────────────────────────────────────
// Creates a DRAFT only — calls createOrReplaceInventoryItem() +
// createOffer() and stops there. Per plan.md §6 "eBay Integration", this
// route must NEVER call publishOffer(); that lives exclusively in
// POST /api/ebay/listings/[id]/publish.
const bodySchema = z.object({
  card_id: z.string().uuid(),
  title: z.string().min(1).max(80), // eBay title limit
  start_price: z.number().min(0).nullable().optional().default(null),
  buy_now_price: z.number().min(0).nullable().optional().default(null),
  category_id: z.string().min(1),
});

const CONDITION_MAP: Record<string, 'NEW' | 'USED_EXCELLENT' | 'USED_GOOD' | 'USED_ACCEPTABLE'> = {
  Mint: 'NEW',
  Excellent: 'USED_EXCELLENT',
  Good: 'USED_GOOD',
  Poor: 'USED_ACCEPTABLE',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const { card_id, title, start_price, buy_now_price, category_id } = parsed.data;

  if (start_price == null && buy_now_price == null) {
    return NextResponse.json(
      { error: 'invalid_price', message: 'At least one of start_price or buy_now_price is required' },
      { status: 400 },
    );
  }

  const [card] = await getDb()
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, card_id), eq(schema.cards.user_id, session.user.id)));
  if (!card) {
    return NextResponse.json({ error: 'not_found', message: 'Card not found' }, { status: 404 });
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

  const sku = `scanna-${card.id}`;
  const merchantLocationKey = process.env.EBAY_MERCHANT_LOCATION_KEY || 'default';
  const price = buy_now_price ?? start_price!;

  try {
    await createOrReplaceInventoryItem(accessToken, {
      sku,
      product: {
        title,
        description: `${card.year} ${card.manufacturer} ${card.product} ${card.player} ${card.card_number}${card.parallel_name ? ` ${card.parallel_name}` : ''}`,
        imageUrls: card.photos,
      },
      condition: CONDITION_MAP[card.condition] ?? 'USED_GOOD',
      availability: { shipToLocationAvailability: { quantity: 1 } },
    });

    const offer = await createOffer(accessToken, {
      sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      categoryId: category_id,
      listingDescription: `${card.year} ${card.manufacturer} ${card.product} ${card.player} ${card.card_number}`,
      pricingSummary: { price: { value: price.toFixed(2), currency: 'USD' } },
      merchantLocationKey,
    });

    const [listing] = await getDb()
      .insert(schema.ebayListings)
      .values({
        card_id,
        ebay_offer_id: offer.offerId,
        sku,
        category_id,
        title,
        start_price: start_price != null ? String(start_price) : null,
        buy_now_price: buy_now_price != null ? String(buy_now_price) : null,
        status: 'draft',
      })
      .returning();

    // Reflect the draft on the card record so Card Detail can show it.
    // Guarded by the version we read above; if the card was concurrently
    // edited (version mismatch), this affects zero rows — checked via
    // .returning() rather than assumed, matching every other mutating
    // route in this codebase (cards/[id] PATCH, ebay/listings/[id] PATCH,
    // publish, sync, sales POST). A silent no-op here would leave the eBay
    // draft created but the card's status stuck on a stale value, so we
    // treat it as a real conflict (409) rather than returning 201 anyway.
    const [updatedCard] = await getDb()
      .update(schema.cards)
      .set({ status: 'listed', version: card.version + 1 })
      .where(and(eq(schema.cards.id, card_id), eq(schema.cards.version, card.version)))
      .returning();

    if (!updatedCard) {
      return NextResponse.json(
        {
          error: 'conflict',
          message:
            'Card was modified by another request after the eBay draft was created; refetch and retry',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    if (err instanceof EbayApiError) {
      console.error('eBay draft creation failed:', err.status, err.message);
      return NextResponse.json({ error: 'ebay_api_error', message: err.message }, { status: 502 });
    }
    throw err;
  }
}
