import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

// ── PATCH /api/sales/[id] ────────────────────────────────────────────────
// Edits a sale record; net_profit is always recomputed server-side from the
// resulting fields, never accepted from the client. No `version` column on
// `sales` (deliberate deviation — see schema.ts and plan.md §4/§8 open
// question #4: sale records are edited rarely, long after creation).
const bodySchema = z.object({
  sale_price: z.number().optional(),
  sale_date: z.string().min(1).optional(),
  platform: z.enum(['eBay', 'other']).optional(),
  fees: z.number().min(0).nullable().optional(),
  shipping_cost: z.number().min(0).nullable().optional(),
  buyer_notes: z.string().nullable().optional(),
});

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const [existing] = await getDb()
    .select({
      sale: schema.sales,
      acquisition_price: schema.cards.acquisition_price,
      user_id: schema.cards.user_id,
    })
    .from(schema.sales)
    .innerJoin(schema.cards, eq(schema.sales.card_id, schema.cards.id))
    .where(eq(schema.sales.id, id));

  if (!existing || existing.user_id !== session.user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const salePrice = parsed.data.sale_price ?? Number(existing.sale.sale_price);
  const fees = parsed.data.fees !== undefined ? parsed.data.fees : existing.sale.fees != null ? Number(existing.sale.fees) : null;
  const shippingCost =
    parsed.data.shipping_cost !== undefined
      ? parsed.data.shipping_cost
      : existing.sale.shipping_cost != null
        ? Number(existing.sale.shipping_cost)
        : null;
  const netProfit = salePrice - (fees ?? 0) - (shippingCost ?? 0) - Number(existing.acquisition_price);

  const [updated] = await getDb()
    .update(schema.sales)
    .set({
      ...(parsed.data.sale_price !== undefined ? { sale_price: String(parsed.data.sale_price) } : {}),
      ...(parsed.data.sale_date !== undefined ? { sale_date: parsed.data.sale_date } : {}),
      ...(parsed.data.platform !== undefined ? { platform: parsed.data.platform } : {}),
      ...(parsed.data.fees !== undefined ? { fees: parsed.data.fees != null ? String(parsed.data.fees) : null } : {}),
      ...(parsed.data.shipping_cost !== undefined
        ? { shipping_cost: parsed.data.shipping_cost != null ? String(parsed.data.shipping_cost) : null }
        : {}),
      ...(parsed.data.buyer_notes !== undefined ? { buyer_notes: parsed.data.buyer_notes } : {}),
      net_profit: String(netProfit),
    })
    .where(and(eq(schema.sales.id, id)))
    .returning();

  return NextResponse.json(updated);
}
