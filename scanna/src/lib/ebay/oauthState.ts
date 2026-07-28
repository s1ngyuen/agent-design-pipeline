// Server-side eBay OAuth `state` (nonce) helpers, shared by
// /api/ebay/oauth/start and /api/ebay/oauth/callback.
//
// Fixes a HIGH-severity gap: `state` used to be a deterministic
// HMAC(AUTH_SECRET, userId) — no expiry, no per-flow nonce, no server-side
// record, and nothing preventing reuse. A leaked `state` value could be
// replayed indefinitely by an attacker to pair their own eBay authorization
// code with another user's account. Now every `/start` call mints a random
// nonce and stores it (src/db/schema.ts `ebay_oauth_states`) with a short
// expiry; `/callback` looks the nonce up, checks it's unexpired and unused,
// atomically marks it used, and only then trusts the associated user_id —
// never derived purely from a value that round-trips through the browser.

import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';

export const EBAY_OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Verifies and atomically consumes a `state` nonce. Returns the associated
 * user id, or null if the nonce is missing, expired, or already used. */
export async function consumeOauthState(nonce: string): Promise<string | null> {
  if (!nonce) return null;

  const cutoff = new Date(Date.now() - EBAY_OAUTH_STATE_TTL_MS);

  // Single UPDATE guarded by unexpired + unused, with RETURNING — this is
  // the atomic "verify and mark used" step: a concurrent replay of the same
  // nonce will affect zero rows on its second attempt.
  const [row] = await getDb()
    .update(schema.ebayOauthStates)
    .set({ used_at: sql`now()` })
    .where(
      and(
        eq(schema.ebayOauthStates.nonce, nonce),
        isNull(schema.ebayOauthStates.used_at),
        sql`${schema.ebayOauthStates.created_at} > ${cutoff.toISOString()}::timestamptz`,
      ),
    )
    .returning({ user_id: schema.ebayOauthStates.user_id });

  return row?.user_id ?? null;
}
