import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import type { TradeItem } from '@/db/schema.trades-table';

// ── PATCH /api/trades/[id] ────────────────────────────────────────────────
// Body: { offering?: TradeItem[]; requesting?: TradeItem[]; trade_with?: string; proposed?: boolean }
//
// IMPORTANT — Lessons Learned: a real bug shipped here once because an
// earlier version of this handler only forwarded `offering`/`requesting` and
// silently dropped `proposed` on every partial update, resetting every
// trade's confirmed/speculative state back to its default on any edit.
// Every field the caller sends must be forwarded — never rebuild the update
// object from a fixed subset of keys.
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

  const b = body as {
    offering?: TradeItem[];
    requesting?: TradeItem[];
    trade_with?: string;
    proposed?: boolean;
  };

  const [updated] = await getDb()
    .update(schema.pending_trades)
    .set({
      ...(b.offering !== undefined ? { offering: b.offering } : {}),
      ...(b.requesting !== undefined ? { requesting: b.requesting } : {}),
      ...(b.trade_with !== undefined ? { trade_with: b.trade_with } : {}),
      ...(b.proposed !== undefined ? { proposed: b.proposed } : {}),
    })
    .where(
      and(
        eq(schema.pending_trades.id, id),
        eq(schema.pending_trades.user_id, session.user.id),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// ── DELETE /api/trades/[id] ───────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const [deleted] = await getDb()
    .delete(schema.pending_trades)
    .where(
      and(
        eq(schema.pending_trades.id, id),
        eq(schema.pending_trades.user_id, session.user.id),
      ),
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
