import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import {
  sportSchema,
  conditionSchema,
  graderSchema,
} from '@/domain/cardAttributesSchema';

// ── GET /api/cards/[id] ──────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const [row] = await getDb()
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.user_id, session.user.id)));

  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(row);
}

// ── PATCH /api/cards/[id] ────────────────────────────────────────────────
// Optimistic concurrency, per the database-neon-drizzle pattern: body must
// include expectedVersion; the update only applies WHERE version matches.
// Zero rows affected -> 409, client refetches.
const patchSchema = z.object({
  expectedVersion: z.number().int(),
  sport: sportSchema.optional(),
  league: z.string().nullable().optional(),
  player: z.string().min(1).optional(),
  team: z.string().min(1).optional(),
  year: z.string().min(1).optional(),
  manufacturer: z.string().min(1).optional(),
  product: z.string().min(1).optional(),
  card_number: z.string().min(1).optional(),
  parallel_name: z.string().nullable().optional(),
  print_run: z.string().min(1).nullable().optional(),
  is_auto: z.boolean().optional(),
  is_rookie: z.boolean().optional(),
  condition: conditionSchema.optional(),
  grade: z.number().nullable().optional(),
  grader: graderSchema.nullable().optional(),
  photos: z.array(z.string()).optional(),
  acquisition_price: z.number().min(0).optional(),
  acquisition_date: z.string().min(1).optional(),
  status: z.enum(['in-stock', 'listed', 'sold']).optional(),
  notes: z.string().nullable().optional(),
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { expectedVersion, grade, acquisition_price, ...rest } = parsed.data;

  const updateValues: Record<string, unknown> = { ...rest };
  if (grade !== undefined) updateValues.grade = grade != null ? String(grade) : null;
  if (acquisition_price !== undefined) updateValues.acquisition_price = String(acquisition_price);

  if (Object.keys(updateValues).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const [updated] = await getDb()
    .update(schema.cards)
    .set({
      ...updateValues,
      version: sql`${schema.cards.version} + 1`,
      updated_at: sql`now()`,
    })
    .where(
      and(
        eq(schema.cards.id, id),
        eq(schema.cards.user_id, session.user.id),
        eq(schema.cards.version, expectedVersion),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: 'conflict', message: 'Card was modified by another request' },
      { status: 409 },
    );
  }

  return NextResponse.json(updated);
}

// ── DELETE /api/cards/[id] ───────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  await getDb()
    .delete(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.user_id, session.user.id)));

  return NextResponse.json({ deleted: true });
}
