import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth'; // from the auth-google-oauth pattern; swap for your own auth check if not using it
import { getDb, schema } from '@/db';

// ── GET /api/items ────────────────────────────────────────────────────────
// Returns the current user's items.
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await getDb()
    .select()
    .from(schema.items)
    .where(eq(schema.items.user_id, session.user.id));

  return NextResponse.json(rows);
}

// ── POST /api/items ───────────────────────────────────────────────────────
// Creates a new item. version starts at 0.
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

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).title !== 'string'
  ) {
    return NextResponse.json({ error: 'Body must be { title: string; data?: Record<string, unknown> }' }, { status: 400 });
  }

  const { title, data } = body as { title: string; data?: Record<string, unknown> };

  const [row] = await getDb()
    .insert(schema.items)
    .values({ user_id: session.user.id, title, data: data ?? {} })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
