import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

// ── PATCH /api/ebay/listings/[id] ────────────────────────────────────────
// Draft-only field edits (title/prices) — optimistic concurrency per the
// pattern (expectedVersion required, 409 on mismatch). Only allowed while
// status === 'draft'; once published, edits go through eBay's update APIs
// instead (not built in this pass — see plan.md's Open Questions on scope).
const bodySchema = z.object({
  expectedVersion: z.number().int(),
  title: z.string().min(1).max(80).optional(),
  start_price: z.number().min(0).nullable().optional(),
  buy_now_price: z.number().min(0).nullable().optional(),
});

export async function PATCH(
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
  const { expectedVersion, title, start_price, buy_now_price } = parsed.data;

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
      { error: 'not_draft', message: 'Only draft listings can be edited here' },
      { status: 400 },
    );
  }

  const [updated] = await getDb()
    .update(schema.ebayListings)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(start_price !== undefined ? { start_price: start_price != null ? String(start_price) : null } : {}),
      ...(buy_now_price !== undefined ? { buy_now_price: buy_now_price != null ? String(buy_now_price) : null } : {}),
      version: sql`${schema.ebayListings.version} + 1`,
      updated_at: sql`now()`,
    })
    .where(and(eq(schema.ebayListings.id, id), eq(schema.ebayListings.version, expectedVersion)))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: 'conflict', message: 'Listing was modified by another request' },
      { status: 409 },
    );
  }

  return NextResponse.json(updated);
}
