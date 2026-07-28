import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

// ── GET /api/checklist/search?q=&sport= ──────────────────────────────────
// Search across checklist_cards — the real per-card reference data scraped
// from manufacturer checklists (see schema.ts). Lets a user search for the
// exact card ("search for a card if I don't want to manually add it") and
// pick a real match instead of typing every field by hand, the same way
// this endpoint's cards-table counterpart (GET /api/cards) already does —
// same pg_trgm ilike+similarity pattern, just against reference data
// instead of a user's own inventory.
//
// Requires q of at least 2 characters — a 1-character/empty query against
// a 5,000+ row table would return a huge, useless, expensive-to-rank result
// set instead of no results.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sport = searchParams.get('sport');
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'q must be at least 2 characters' }, { status: 400 });
  }

  const conditions = [ilike(schema.checklistCards.search_text, `%${q.toLowerCase()}%`)];
  if (sport && ['NFL', 'NBA', 'UFC', 'Soccer'].includes(sport)) {
    conditions.push(eq(schema.checklistCards.sport, sport as 'NFL' | 'NBA' | 'UFC' | 'Soccer'));
  }

  const rows = await getDb()
    .select({
      id: schema.checklistCards.id,
      sport: schema.checklistCards.sport,
      year: schema.checklistCards.year,
      manufacturer: schema.checklistCards.manufacturer,
      product: schema.checklistCards.product,
      subset: schema.checklistCards.subset,
      card_number: schema.checklistCards.card_number,
      player: schema.checklistCards.player,
      team: schema.checklistCards.team,
      parallel_name: schema.checklistCards.parallel_name,
      print_run: schema.checklistCards.print_run,
      is_auto: schema.checklistCards.is_auto,
      is_rookie: schema.checklistCards.is_rookie,
    })
    .from(schema.checklistCards)
    .where(and(...conditions))
    .orderBy(sql`similarity(${schema.checklistCards.search_text}, ${q.toLowerCase()}) DESC`)
    .limit(25);

  return NextResponse.json(rows);
}
