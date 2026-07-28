import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { cardAttributesSchema } from '@/domain/cardAttributesSchema';
import { valueEstimateSchema } from '@/lib/estimate/valueEstimateSchema';

// ── GET /api/cards?status=&sport=&q= ────────────────────────────────────────
// Search uses the pg_trgm GIN index on cards.search_text (fuzzy/substring
// match on player/team/manufacturer/product/parallel/card_number/year — see
// schema.ts) rather than a dedicated search vendor, per
// .claude/rules/technical-defaults.md "Search".
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const sport = searchParams.get('sport');
  const q = searchParams.get('q')?.trim();

  const conditions = [eq(schema.cards.user_id, session.user.id)];

  if (status && ['in-stock', 'listed', 'sold'].includes(status)) {
    conditions.push(eq(schema.cards.status, status as 'in-stock' | 'listed' | 'sold'));
  }
  if (sport && ['NFL', 'NBA', 'UFC', 'Soccer'].includes(sport)) {
    conditions.push(eq(schema.cards.sport, sport as 'NFL' | 'NBA' | 'UFC' | 'Soccer'));
  }
  if (q) {
    conditions.push(ilike(schema.cards.search_text, `%${q.toLowerCase()}%`));
  }

  const rows = await getDb()
    .select()
    .from(schema.cards)
    .where(and(...conditions))
    .orderBy(
      q ? sql`similarity(${schema.cards.search_text}, ${q.toLowerCase()}) DESC` : desc(schema.cards.created_at),
    );

  return NextResponse.json(rows);
}

// ── POST /api/cards ──────────────────────────────────────────────────────
// Creates a card. Body = full card-shape fields + acquisition details +
// (optionally) the ValueEstimate already produced by POST /api/estimate —
// this route never calls Claude itself, per plan.md §5 (estimate is a
// separate, pure-function step the caller runs first).
const createCardSchema = cardAttributesSchema.extend({
  photos: z.array(z.string()).optional().default([]),
  acquisition_price: z.number().min(0),
  acquisition_date: z.string().min(1), // "YYYY-MM-DD"
  notes: z.string().nullable().optional().default(null),
  estimate: valueEstimateSchema.nullable().optional().default(null),
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

  const parsed = createCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const { estimate, ...card } = parsed.data;

  const [row] = await getDb()
    .insert(schema.cards)
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
      photos: card.photos,
      acquisition_price: String(card.acquisition_price),
      acquisition_date: card.acquisition_date,
      status: 'in-stock',
      estimated_value: estimate ? String(estimate.range.mid) : null,
      value_estimate_detail: estimate ?? null,
      notes: card.notes,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
