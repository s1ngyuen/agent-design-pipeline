import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { exchangeAuthorizationCode } from '@/lib/ebay/auth';
import { consumeOauthState } from '@/lib/ebay/oauthState';
import { EbayApiError } from '@/lib/ebay/config';

// ── GET /api/ebay/oauth/callback ─────────────────────────────────────────
// NOT in plan.md's explicit route list — the counterpart to
// /api/ebay/oauth/start (see that file's comment for why this pair exists).
//
// `state` is verified against the server-side `ebay_oauth_states` record
// (src/lib/ebay/oauthState.ts) rather than requiring a live session — eBay's
// redirect is a top-level browser navigation with no guarantee our session
// cookie survives the round-trip in every browser — and rather than trusting
// a deterministically-derivable value. consumeOauthState() atomically checks
// the nonce is unexpired and unused and marks it used in the same statement,
// so a replayed `state` (e.g. a leaked URL) fails on its second use. Only the
// user_id resolved server-side from that lookup is ever trusted; it's never
// taken from anything the browser could have tampered with.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  const userId = await consumeOauthState(state);
  if (!userId) {
    return NextResponse.json(
      { error: 'invalid_state', message: 'Invalid, expired, or already-used state parameter' },
      { status: 400 },
    );
  }

  try {
    await exchangeAuthorizationCode(userId, code);
  } catch (err) {
    if (err instanceof EbayApiError) {
      console.error('eBay OAuth code exchange failed:', err.status, err.message);
      return NextResponse.json({ error: 'ebay_api_error', message: err.message }, { status: 502 });
    }
    throw err;
  }

  // Redirect back into the app (Card Detail / Listings, once built by
  // frontend-developer) rather than returning raw JSON to a browser tab.
  return NextResponse.redirect(new URL('/listings', req.nextUrl.origin));
}
