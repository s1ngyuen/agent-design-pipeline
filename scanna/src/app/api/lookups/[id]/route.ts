import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { computeBuySignal } from '@/lib/estimate/buySignal';
import { valueEstimateSchema } from '@/lib/estimate/valueEstimateSchema';
import type { ValueEstimate } from '@/domain/types';

// ── PATCH /api/lookups/[id] ─────────────────────────────────────────────
// Sets/updates asking_price and/or estimate, recomputing buy_signal
// server-side. `estimate` is optional and only sent when the caller has
// just recalculated a fresh one via POST /api/estimate (forceRecalculate) —
// this route never calls Claude itself, it only persists a result the
// caller already computed, same "estimate is a pure function step,
// persistence is separate" split as the rest of this app. No
// `version`/expectedVersion here — lookups is a deliberate deviation from
// the optimistic-concurrency convention (write-once-then-rarely-edited,
// single-actor in practice; see schema.ts and plan.md §4/§8 open question #4).
const bodySchema = z.object({
  asking_price: z.number().min(0).nullable().optional(),
  estimate: valueEstimateSchema.optional(),
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

  const [lookup] = await getDb()
    .select()
    .from(schema.lookups)
    .where(and(eq(schema.lookups.id, id), eq(schema.lookups.user_id, session.user.id)));

  if (!lookup) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { asking_price, estimate } = parsed.data;
  const estimateDetail: ValueEstimate | null = estimate ?? (lookup.value_estimate_detail as ValueEstimate | null);
  const effectiveAskingPrice =
    asking_price !== undefined ? asking_price : lookup.asking_price != null ? Number(lookup.asking_price) : null;
  const buySignal =
    effectiveAskingPrice != null && estimateDetail ? computeBuySignal(estimateDetail.range, effectiveAskingPrice) : null;

  const [updated] = await getDb()
    .update(schema.lookups)
    .set({
      ...(asking_price !== undefined ? { asking_price: asking_price != null ? String(asking_price) : null } : {}),
      ...(estimate ? { estimated_value: String(estimate.range.mid), value_estimate_detail: estimate } : {}),
      buy_signal: buySignal,
    })
    .where(and(eq(schema.lookups.id, id), eq(schema.lookups.user_id, session.user.id)))
    .returning();

  return NextResponse.json(updated);
}
