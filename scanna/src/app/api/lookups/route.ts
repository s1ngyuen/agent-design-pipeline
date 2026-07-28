import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { cardAttributesSchema } from '@/domain/cardAttributesSchema';
import { valueEstimateSchema } from '@/lib/estimate/valueEstimateSchema';
import { computeBuySignal } from '@/lib/estimate/buySignal';

// ── GET /api/lookups?limit= ─────────────────────────────────────────────
// Recently Looked Up (Research Mode) — most recent first.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

  const rows = await getDb()
    .select()
    .from(schema.lookups)
    .where(eq(schema.lookups.user_id, session.user.id))
    .orderBy(desc(schema.lookups.looked_up_at))
    .limit(limit);

  return NextResponse.json(rows);
}

// ── POST /api/lookups ────────────────────────────────────────────────────
// Research Mode: card-shape fields + the ValueEstimate from POST /api/estimate
// + optional asking_price. buy_signal is computed server-side, never trusted
// from the client, per plan.md §6 "Shared Pipeline".
const createLookupSchema = cardAttributesSchema.extend({
  estimate: valueEstimateSchema,
  asking_price: z.number().min(0).nullable().optional().default(null),
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

  const parsed = createLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const { estimate, asking_price, ...card } = parsed.data;
  const buySignal = asking_price != null ? computeBuySignal(estimate.range, asking_price) : null;

  const [row] = await getDb()
    .insert(schema.lookups)
    .values({
      user_id: session.user.id,
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
      grade: card.grade != null ? String(card.grade) : null,
      grader: card.grader,
      estimated_value: String(estimate.range.mid),
      value_estimate_detail: estimate,
      asking_price: asking_price != null ? String(asking_price) : null,
      buy_signal: buySignal,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
