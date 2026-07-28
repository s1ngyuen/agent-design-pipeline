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

// ── POST /api/estimate ──────────────────────────────────────────────────────
// Pure function endpoint (plan.md §5) — takes CardAttributes, returns a
// ValueEstimate. Does NOT persist anything; the caller (Collection's
// POST /api/cards or Research's POST /api/lookups) is responsible for
// storing the result. Shared by both Collection and Research flows via
// lib/pipeline/identifyAndEstimate.ts.

const bodySchema = z.object({
  card: cardAttributesSchema,
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

  try {
    const estimate = await estimateCardValue(parsedBody.data.card);
    return NextResponse.json(estimate);
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
