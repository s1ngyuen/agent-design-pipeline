import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import type { TradeItem } from '@/db/schema.trades-table';

// ── GET /api/trades ───────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await getDb()
    .select()
    .from(schema.pending_trades)
    .where(eq(schema.pending_trades.user_id, session.user.id))
    .orderBy(desc(schema.pending_trades.created_at));

  return NextResponse.json(rows);
}

// ── POST /api/trades ──────────────────────────────────────────────────────
// Body: { offering: TradeItem[]; requesting: TradeItem[]; trade_with?: string; proposed?: boolean }
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

  const b = body as {
    offering?: TradeItem[];
    requesting?: TradeItem[];
    trade_with?: string;
    proposed?: boolean;
  };

  if (
    (!b.offering?.length && !b.requesting?.length) ||
    !Array.isArray(b.offering ?? []) ||
    !Array.isArray(b.requesting ?? [])
  ) {
    return NextResponse.json(
      { error: 'offering or requesting must have at least one item' },
      { status: 400 },
    );
  }

  const [row] = await getDb()
    .insert(schema.pending_trades)
    .values({
      user_id:    session.user.id,
      offering:   b.offering ?? [],
      requesting: b.requesting ?? [],
      trade_with: b.trade_with ?? null,
      proposed:   b.proposed ?? true, // default: speculative until confirmed
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
