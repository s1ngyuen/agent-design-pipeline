import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { fetchChecklist, TcdbUnavailableError, TcdbApiError, type TcdbSport } from '@/lib/tcdb/client';

// ── GET /api/tcdb/checklist?sport=NFL|NBA ────────────────────────────────
// Server-side cached proxy for TCDB checklist data (NFL/NBA only, per
// brief.md — Soccer/UFC are manual-entry-only/deferred). This is also the
// payload the PWA's service worker caches client-side for offline
// manual-entry dropdowns (plan.md §PWA), hence the explicit Cache-Control
// header enabling stale-while-revalidate.
//
// Server-side cache: a simple module-scope TTL cache. This is a single-
// region serverless function per plan.md §1a, so this cache is
// best-effort/per-instance (not a shared/distributed cache) — acceptable
// here since TCDB checklists change rarely and a cold instance simply
// refetches once.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — checklists change rarely
const cache = new Map<TcdbSport, { data: unknown; expiresAt: number }>();

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sport = searchParams.get('sport');
  if (sport !== 'NFL' && sport !== 'NBA') {
    return NextResponse.json({ error: 'sport must be "NFL" or "NBA"' }, { status: 400 });
  }

  const cached = cache.get(sport);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400' },
    });
  }

  try {
    const entries = await fetchChecklist(sport);
    cache.set(sport, { data: entries, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(entries, {
      headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    if (err instanceof TcdbUnavailableError) {
      return NextResponse.json({ error: 'not_configured', message: err.message }, { status: 501 });
    }
    if (err instanceof TcdbApiError) {
      console.error('TCDB checklist fetch failed:', err.message);
      return NextResponse.json({ error: 'tcdb_api_error', message: err.message }, { status: 502 });
    }
    console.error('Unexpected error in /api/tcdb/checklist', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
