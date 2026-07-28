import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { toCsv } from '@/lib/csv';

// ── GET /api/cards/export?status=&sport=&q= ─────────────────────────────
// CSV stream of the current user's inventory (filterable with the same
// params as GET /api/cards) — for taxes, accounting, or backup.
const EXPORT_COLUMNS = [
  'id', 'sport', 'league', 'player', 'team', 'year', 'manufacturer', 'product',
  'card_number', 'parallel_name', 'print_run', 'is_auto', 'is_rookie', 'condition',
  'grade', 'grader', 'acquisition_price', 'acquisition_date', 'status',
  'estimated_value', 'notes', 'created_at', 'updated_at',
];

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

  const csv = toCsv(rows as unknown as Record<string, unknown>[], EXPORT_COLUMNS);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="scanna-inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
