import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

// ── GET /api/dashboard/stats ─────────────────────────────────────────────
// Business-level stats, computed server-side with aggregate SQL (no N+1 —
// three small aggregate queries, not a per-card/per-sale loop).
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const [statusCounts, inventoryValue, salesTotals] = await Promise.all([
    getDb()
      .select({
        status: schema.cards.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.cards)
      .where(eq(schema.cards.user_id, userId))
      .groupBy(schema.cards.status),

    getDb()
      .select({
        totalEstimatedValue: sql<string>`coalesce(sum(${schema.cards.estimated_value}), 0)`,
        totalAcquisitionCost: sql<string>`coalesce(sum(${schema.cards.acquisition_price}), 0)`,
      })
      .from(schema.cards)
      .where(and(eq(schema.cards.user_id, userId), sql`${schema.cards.status} != 'sold'`)),

    getDb()
      .select({
        totalSalePrice: sql<string>`coalesce(sum(${schema.sales.sale_price}), 0)`,
        totalNetProfit: sql<string>`coalesce(sum(${schema.sales.net_profit}), 0)`,
        totalFees: sql<string>`coalesce(sum(${schema.sales.fees}), 0)`,
        totalShipping: sql<string>`coalesce(sum(${schema.sales.shipping_cost}), 0)`,
        saleCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.sales)
      .innerJoin(schema.cards, eq(schema.sales.card_id, schema.cards.id))
      .where(eq(schema.cards.user_id, userId)),
  ]);

  const countsByStatus: Record<string, number> = { 'in-stock': 0, listed: 0, sold: 0 };
  for (const row of statusCounts) {
    countsByStatus[row.status] = row.count;
  }

  return NextResponse.json({
    counts_by_status: countsByStatus,
    total_cards: countsByStatus['in-stock'] + countsByStatus['listed'] + countsByStatus['sold'],
    inventory_estimated_value: Number(inventoryValue[0]?.totalEstimatedValue ?? 0),
    inventory_acquisition_cost: Number(inventoryValue[0]?.totalAcquisitionCost ?? 0),
    sales: {
      count: salesTotals[0]?.saleCount ?? 0,
      total_sale_price: Number(salesTotals[0]?.totalSalePrice ?? 0),
      total_net_profit: Number(salesTotals[0]?.totalNetProfit ?? 0),
      total_fees: Number(salesTotals[0]?.totalFees ?? 0),
      total_shipping: Number(salesTotals[0]?.totalShipping ?? 0),
    },
  });
}
