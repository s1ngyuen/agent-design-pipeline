import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Same reasoning as /api/estimate — this also runs estimateCardValue()'s
// live web-search research loop, so it needs the same headroom.
export const maxDuration = 60;
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { estimateCardValue, ClaudeEstimateError } from '@/lib/estimate/claudeEstimate';
import { saveEstimateToCache } from '@/lib/estimate/estimateCache';
import type { CardAttributes } from '@/domain/types';

// ── POST /api/cards/[id]/estimate ───────────────────────────────────────
// Re-runs the Claude value estimate for an existing card and PATCHes the
// card with the new value_estimate_detail/estimated_value, per plan.md §5.
// Still a mutating write to `cards`, so it follows the same optimistic
// concurrency convention as PATCH (expectedVersion required, 409 on
// mismatch) rather than skipping it just because it's a "re-estimate."
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

  const [card] = await getDb()
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.user_id, session.user.id)));

  if (!card) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (card.version !== parsed.data.expectedVersion) {
    return NextResponse.json(
      { error: 'conflict', message: 'Card was modified by another request' },
      { status: 409 },
    );
  }

  const attributes: CardAttributes = {
    sport: card.sport,
    league: card.league,
    player: card.player,
    team: card.team,
    year: card.year,
    manufacturer: card.manufacturer,
    product: card.product,
    card_number: card.card_number,
    parallel_name: card.parallel_name,
    print_run: card.print_run,
    is_auto: card.is_auto,
    is_rookie: card.is_rookie,
    condition: card.condition,
    grade: card.grade != null ? Number(card.grade) : null,
    grader: card.grader,
  };

  let estimate;
  try {
    estimate = await estimateCardValue(attributes);
  } catch (err) {
    if (err instanceof ClaudeEstimateError) {
      console.error('Re-estimate failed:', err.message);
      return NextResponse.json({ error: 'estimate_failed', message: err.message }, { status: 502 });
    }
    console.error('Unexpected error in /api/cards/[id]/estimate', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  // This route is always a deliberate, explicit recalculation (the user
  // clicked "Re-estimate" on a card already in their collection) — it never
  // reads the cache, only writes to it, so a later first-time /api/estimate
  // lookup for the same card identity can benefit. A cache write failure
  // (e.g. the migration adding value_estimate_cache hasn't run on this
  // database yet) must never discard an estimate that already succeeded —
  // that would waste the credits just spent and show a false error.
  try {
    await saveEstimateToCache(attributes, estimate);
  } catch (err) {
    console.error('Estimate cache write failed (re-estimate itself still succeeded):', err);
  }

  const [updated] = await getDb()
    .update(schema.cards)
    .set({
      estimated_value: String(estimate.range.mid),
      value_estimate_detail: estimate,
      version: sql`${schema.cards.version} + 1`,
      updated_at: sql`now()`,
    })
    .where(
      and(
        eq(schema.cards.id, id),
        eq(schema.cards.user_id, session.user.id),
        eq(schema.cards.version, parsed.data.expectedVersion),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: 'conflict', message: 'Card was modified by another request' },
      { status: 409 },
    );
  }

  return NextResponse.json(updated);
}
