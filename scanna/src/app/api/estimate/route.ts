import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Claude's web_search/web_fetch research loop (claudeEstimate.ts) can run up
// to MAX_TOOL_LOOP_ITERATIONS turns and easily takes well past Vercel's
// default function timeout (10s) — almost certainly why estimates "take
// ages" (the function gets killed mid-research, not that Claude is just
// slow). 60s is the max configurable on the Hobby plan without upgrading;
// revisit if 8 iterations of real web research still needs more room.
export const maxDuration = 60;
import { z } from 'zod';
import { auth } from '@/auth';
import { cardAttributesSchema } from '@/domain/cardAttributesSchema';
import { estimateCardValue, ClaudeEstimateError } from '@/lib/estimate/claudeEstimate';
import { lookupCachedEstimate, saveEstimateToCache } from '@/lib/estimate/estimateCache';

// ── POST /api/estimate ──────────────────────────────────────────────────────
// Pure function endpoint (plan.md §5) — takes CardAttributes, returns a
// ValueEstimate (wrapped with cache metadata — see value_estimate_cache in
// schema.ts). Does NOT persist anything to cards/lookups; the caller
// (Collection's POST /api/cards or Research's POST /api/lookups) is
// responsible for storing the result. Shared by both Collection and
// Research flows via lib/pipeline/identifyAndEstimate.ts.
//
// Checks the cache first (same card identity + condition/grade — a live
// Claude web-search call is real cost and close to the 60s timeout on its
// own, not worth repeating for e.g. a multi-copy lot of the same parallel).
// Pass forceRecalculate to skip the cache and get a fresh live estimate.

const bodySchema = z.object({
  card: cardAttributesSchema,
  forceRecalculate: z.boolean().optional().default(false),
});

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

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsedBody.error.issues },
      { status: 400 },
    );
  }

  const { card, forceRecalculate } = parsedBody.data;

  // Cache is an optimization, not a hard dependency — a lookup/write
  // failure here (e.g. the migration adding value_estimate_cache hasn't
  // been applied to this database yet) should degrade to "just call
  // Claude fresh," never take down estimation entirely.
  if (!forceRecalculate) {
    try {
      const cached = await lookupCachedEstimate(card);
      if (cached) {
        return NextResponse.json({ estimate: cached.estimate, cached: true, cachedAt: cached.cachedAt });
      }
    } catch (err) {
      console.error('Estimate cache lookup failed, falling back to a live call:', err);
    }
  }

  try {
    const estimate = await estimateCardValue(card);
    try {
      await saveEstimateToCache(card, estimate);
    } catch (err) {
      console.error('Estimate cache write failed (estimate itself still succeeded):', err);
    }
    return NextResponse.json({ estimate, cached: false, cachedAt: null });
  } catch (err) {
    if (err instanceof ClaudeEstimateError) {
      // err.message is a generic wrapper ("Anthropic API request failed") —
      // log err.cause too, since that's the actual Anthropic SDK error
      // (status code, error type, message) needed to diagnose real failures
      // like an invalid key or no credits, rather than just knowing *that*
      // it failed.
      console.error('Claude estimate failed:', err.message, '| cause:', err.cause);
      return NextResponse.json({ error: 'estimate_failed', message: err.message }, { status: 502 });
    }
    console.error('Unexpected error in /api/estimate', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
