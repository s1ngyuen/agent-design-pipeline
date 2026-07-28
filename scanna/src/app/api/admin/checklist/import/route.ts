import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { loadChecklistFiles, importChecklistRows } from '@/db/checklistImport';

// ── GET /api/admin/checklist/import ──────────────────────────────────────
// TEMPORARY, one-off route: applies any pending migrations (specifically
// the checklist_cards table) and imports every file in
// src/db/checklist-data/ into the production database.
//
// Same reasoning as /api/admin/seed: DATABASE_URL/DIRECT_URL are Sensitive
// Vercel env vars, unreadable via CLI/dashboard, so neither `drizzle-kit
// migrate` nor the db:import-checklist script can reach production from a
// local machine — this route runs inside the deployed app instead, where
// those vars are fully accessible at request time. Uses drizzle-orm's own
// migrator (not hand-rolled SQL) so it's the exact same mechanism as
// `drizzle-kit migrate` and shares its __drizzle_migrations tracking table
// — safe to run again later once real migrations follow this one.
//
// Import itself is also safe to call repeatedly: importChecklistRows()
// skips rows that already exist (ON CONFLICT DO NOTHING on the
// product+subset+card_number+player unique index) — no double-import risk.
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await migrate(getDb(), { migrationsFolder: './migrations' });

  const files = loadChecklistFiles();
  const results = [];
  for (const { file, rows } of files) {
    const { inserted, skipped } = await importChecklistRows(rows);
    results.push({ file, rows: rows.length, inserted, skipped });
  }

  return NextResponse.json({ migrated: true, files: results });
}
