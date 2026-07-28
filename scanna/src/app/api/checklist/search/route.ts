import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

// ── GET /api/checklist/search?q=&sport= ──────────────────────────────────
// Search across checklist_cards — the real per-card reference data scraped
// from manufacturer checklists (see schema.ts). Lets a user search for the
// exact card ("search for a card if I don't want to manually add it") and
// pick a real match instead of typing every field by hand.
//
// Deliberately NOT a single ilike(search_text, '%q%') like /api/cards uses —
// that treats the whole query as one literal contiguous substring, so
// "cooper dejean auto" never matches a row whose search_text is "cooper
// dejean philadelphia eagles topps 2025 topps finest football finest
// autographs fa-cdj 2025" (the team name sits between player and product,
// breaking contiguity). Instead, each whitespace-separated token is
// required to match independently (AND'd together) — order-independent,
// so "dejean auto" and "auto dejean" both work. "auto"/"rookie"-family
// tokens match the is_auto/is_rookie booleans directly rather than relying
// on the word happening to appear in the subset name (e.g. a rookie card
// whose subset is plain "Base" has no "rookie" text anywhere to match).
//
// Requires q of at least 2 characters — a 1-character/empty query against
// a 150,000+ row table would return a huge, useless, expensive-to-rank
// result set instead of no results.
const AUTO_KEYWORDS = new Set(['auto', 'autos', 'autograph', 'autographs', 'autographed']);
const ROOKIE_KEYWORDS = new Set(['rookie', 'rookies', 'rc']);

function tokenCondition(token: string): SQL {
  const lower = token.toLowerCase();
  if (AUTO_KEYWORDS.has(lower)) return eq(schema.checklistCards.is_auto, true);
  if (ROOKIE_KEYWORDS.has(lower)) return eq(schema.checklistCards.is_rookie, true);
  return ilike(schema.checklistCards.search_text, `%${lower}%`);
}

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

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const conditions = tokens.map(tokenCondition);
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
