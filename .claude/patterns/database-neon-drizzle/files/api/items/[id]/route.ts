import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

// ── PATCH /api/items/[id] ─────────────────────────────────────────────────
// Optimistic-concurrency pattern: body must include expectedVersion. The
// update only applies if the row's current version still matches — if
// another request changed it first, zero rows are affected and we return
// 409 so the client can refetch and retry instead of silently overwriting.
//
// Body: { expectedVersion: number; title?: string; data?: Record<string, unknown> }
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

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).expectedVersion !== 'number'
  ) {
    return NextResponse.json(
      { error: 'Body must include expectedVersion: number' },
      { status: 400 },
    );
  }

  const { expectedVersion, title, data } = body as {
    expectedVersion: number;
    title?: string;
    data?: Record<string, unknown>;
  };

  const [updated] = await getDb()
    .update(schema.items)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(data !== undefined ? { data } : {}),
      version:    sql`${schema.items.version} + 1`,
      updated_at: sql`now()`,
    })
    .where(
      and(
        eq(schema.items.id, id),
        eq(schema.items.user_id, session.user.id),
        eq(schema.items.version, expectedVersion),
      ),
    )
    .returning();

  if (!updated) {
    // Either the row doesn't exist/belong to this user, or version didn't
    // match — return 409 so the client refetches. Distinguishing the two
    // cases isn't worth an extra query; the client's refetch handles both.
    return NextResponse.json(
      { error: 'conflict', message: 'Item was modified by another request' },
      { status: 409 },
    );
  }

  return NextResponse.json(updated);
}

// ── DELETE /api/items/[id] ────────────────────────────────────────────────
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
    .delete(schema.items)
    .where(and(eq(schema.items.id, id), eq(schema.items.user_id, session.user.id)));

  return NextResponse.json({ deleted: true });
}
