import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import type { ValueEstimate } from '@/domain/types';

// ── POST /api/lookups/[id]/convert ──────────────────────────────────────
// "Add to Inventory": takes the already-computed estimate from the lookup,
// asks for acquisition_price/acquisition_date, creates a real `cards` row,
// and sets lookups.converted_card_id — the only bridge from Research into
// Collection (plan.md §6 "Shared Pipeline").
//
// Note: the neon-http Drizzle adapter (per plan.md's Neon/Drizzle pattern)
// does not support interactive transactions, so this is two sequential
// writes rather than one atomic transaction. If the second write (linking
// converted_card_id) fails after the card is created, the card still exists
// correctly in inventory — the only side effect is the lookup not showing
// as converted, which is safe to retry/fix manually and doesn't corrupt
// financial data.
const bodySchema = z.object({
  acquisition_price: z.number().min(0),
  acquisition_date: z.string().min(1),
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

  const [lookup] = await getDb()
    .select()
    .from(schema.lookups)
    .where(and(eq(schema.lookups.id, id), eq(schema.lookups.user_id, session.user.id)));

  if (!lookup) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (lookup.converted_card_id) {
    return NextResponse.json(
      { error: 'already_converted', message: 'This lookup was already converted to a card' },
      { status: 409 },
    );
  }

  const estimate = lookup.value_estimate_detail as ValueEstimate | null;

  const [card] = await getDb()
    .insert(schema.cards)
    .values({
      user_id: session.user.id,
      sport: lookup.sport,
      league: lookup.league,
      player: lookup.player,
      team: lookup.team,
      year: lookup.year,
      manufacturer: lookup.manufacturer,
      product: lookup.product,
      card_number: lookup.card_number,
      parallel_name: lookup.parallel_name,
      print_run: lookup.print_run,
      is_auto: lookup.is_auto,
      is_rookie: lookup.is_rookie,
      condition: lookup.condition,
      grade: lookup.grade,
      grader: lookup.grader,
      photos: [],
      acquisition_price: String(parsed.data.acquisition_price),
      acquisition_date: parsed.data.acquisition_date,
      status: 'in-stock',
      estimated_value: lookup.estimated_value,
      value_estimate_detail: estimate,
      notes: null,
    })
    .returning();

  await getDb()
    .update(schema.lookups)
    .set({ converted_card_id: card.id })
    .where(and(eq(schema.lookups.id, id), eq(schema.lookups.user_id, session.user.id)));

  return NextResponse.json(card, { status: 201 });
}
