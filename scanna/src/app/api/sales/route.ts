import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

// ── GET /api/sales ───────────────────────────────────────────────────────
// Sales history for the current user, most recent first. Joined against
// cards (not N+1 — a single query) so the response includes basic card
// identity without a separate round-trip per row.
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await getDb()
    .select({
      id: schema.sales.id,
      card_id: schema.sales.card_id,
      ebay_listing_id: schema.sales.ebay_listing_id,
      sale_price: schema.sales.sale_price,
      sale_date: schema.sales.sale_date,
      platform: schema.sales.platform,
      fees: schema.sales.fees,
      shipping_cost: schema.sales.shipping_cost,
      net_profit: schema.sales.net_profit,
      buyer_notes: schema.sales.buyer_notes,
      created_at: schema.sales.created_at,
      card_player: schema.cards.player,
      card_sport: schema.cards.sport,
      card_year: schema.cards.year,
    })
    .from(schema.sales)
    .innerJoin(schema.cards, eq(schema.sales.card_id, schema.cards.id))
    .where(eq(schema.cards.user_id, session.user.id))
    .orderBy(desc(schema.sales.sale_date));

  return NextResponse.json(rows);
}

// ── POST /api/sales ──────────────────────────────────────────────────────
// Marks a card sold: creates the sale record (server computes net_profit)
// and sets cards.status = 'sold'. This mutates `cards`, so — per the
// optimistic-concurrency convention applied to every mutating route on
// cards/ebay_listings — expectedVersion (the card's current version) is
// required and checked in the status-update WHERE clause; a mismatch
// returns 409 without creating the sale record.
//
// Note: the neon-http driver has no transaction support (see
// lookups/[id]/convert/route.ts), so the version check runs FIRST — the
// sale row is only inserted after the card's status update succeeds, to
// avoid ever recording a sale against a card whose state we couldn't
// safely transition.
const bodySchema = z.object({
  card_id: z.string().uuid(),
  ebay_listing_id: z.string().uuid().nullable().optional().default(null),
  sale_price: z.number(),
  sale_date: z.string().min(1),
  platform: z.enum(['eBay', 'other']),
  fees: z.number().min(0).nullable().optional().default(null),
  shipping_cost: z.number().min(0).nullable().optional().default(null),
  buyer_notes: z.string().nullable().optional().default(null),
  expectedVersion: z.number().int(),
});

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
  const { card_id, ebay_listing_id, sale_price, sale_date, platform, fees, shipping_cost, buyer_notes, expectedVersion } =
    parsed.data;

  const [card] = await getDb()
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, card_id), eq(schema.cards.user_id, session.user.id)));

  if (!card) {
    return NextResponse.json({ error: 'not_found', message: 'Card not found' }, { status: 404 });
  }
  if (card.status === 'sold') {
    return NextResponse.json(
      { error: 'already_sold', message: 'This card already has a sale recorded' },
      { status: 409 },
    );
  }

  const netProfit = sale_price - (fees ?? 0) - (shipping_cost ?? 0) - Number(card.acquisition_price);

  const [updatedCard] = await getDb()
    .update(schema.cards)
    .set({ status: 'sold', version: sql`${schema.cards.version} + 1`, updated_at: sql`now()` })
    .where(
      and(
        eq(schema.cards.id, card_id),
        eq(schema.cards.user_id, session.user.id),
        eq(schema.cards.version, expectedVersion),
      ),
    )
    .returning();

  if (!updatedCard) {
    return NextResponse.json(
      { error: 'conflict', message: 'Card was modified by another request' },
      { status: 409 },
    );
  }

  const [sale] = await getDb()
    .insert(schema.sales)
    .values({
      card_id,
      ebay_listing_id,
      sale_price: String(sale_price),
      sale_date,
      platform,
      fees: fees != null ? String(fees) : null,
      shipping_cost: shipping_cost != null ? String(shipping_cost) : null,
      net_profit: String(netProfit),
      buyer_notes,
    })
    .returning();

  return NextResponse.json(sale, { status: 201 });
}
