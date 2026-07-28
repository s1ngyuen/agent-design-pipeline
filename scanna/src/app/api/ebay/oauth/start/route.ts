import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';
import { getEbayAuthorizationUrl } from '@/lib/ebay/auth';

// ── GET /api/ebay/oauth/start ────────────────────────────────────────────
// NOT in plan.md's explicit route list (§5) — added because
// lib/ebay/auth.ts's "OAuth token exchange... stored per-user"
// (plan.md §6 "eBay Integration") has no way to begin without an
// initiation step. Redirects the signed-in user to eBay's consent screen.
//
// `state` is a random, single-use, server-tracked nonce (see
// src/lib/ebay/oauthState.ts and src/db/schema.ts `ebay_oauth_states`) —
// NOT a deterministic HMAC(userId) like the previous implementation, which
// had no expiry, no nonce, and no way to invalidate a leaked value. Storing
// the nonce server-side means the callback never has to trust a value that
// round-trips through the browser/URL; it looks the row up in the database.
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nonce = randomBytes(32).toString('base64url');

  await getDb().insert(schema.ebayOauthStates).values({
    nonce,
    user_id: session.user.id,
  });

  const url = getEbayAuthorizationUrl(nonce);
  return NextResponse.redirect(url);
}
