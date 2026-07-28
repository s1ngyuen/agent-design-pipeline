// eBay OAuth token exchange/refresh, stored per-user, per plan.md §6
// "eBay Integration". The Inventory/Offer APIs act on a specific seller's
// account and require a user access token from the 3-legged
// authorization-code OAuth flow — a client-credentials app token (used for
// e.g. read-only Taxonomy API calls) is not sufficient for those.
//
// Token storage lives in `ebay_accounts` (src/db/schema.ts) — one row per
// app user who has connected their eBay seller account. That table is a
// deviation from plan.md §4 (which never defined where OAuth tokens would
// be stored) flagged there and here for sign-off.

import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getEbayApiBase, getEbayAuthBase, EbayApiError } from './config';
import { encryptToken, decryptToken } from './tokenEncryption';

const SELL_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.inventory';

export class EbayNotConnectedError extends Error {
  constructor(message = 'This user has not connected an eBay seller account yet') {
    super(message);
    this.name = 'EbayNotConnectedError';
  }
}

function getCredentials(): { clientId: string; clientSecret: string; ruName: string } {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const ruName = process.env.EBAY_RU_NAME;
  if (!clientId || !clientSecret || !ruName) {
    throw new Error('EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_RU_NAME must all be configured');
  }
  return { clientId, clientSecret, ruName };
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/** Builds the eBay user-consent redirect URL for the "connect eBay account" flow. */
export function getEbayAuthorizationUrl(state: string): string {
  const { clientId, ruName } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: ruName,
    response_type: 'code',
    scope: SELL_SCOPE,
    state,
  });
  return `${getEbayAuthBase()}/oauth2/authorize?${params.toString()}`;
}

interface EbayTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
}

async function requestToken(body: URLSearchParams): Promise<EbayTokenResponse> {
  const { clientId, clientSecret } = getCredentials();
  const res = await fetch(`${getEbayApiBase()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    // Never log token values — only status/response metadata.
    const text = await res.text().catch(() => '');
    throw new EbayApiError(`eBay token request failed (${res.status})`, res.status, text);
  }
  return (await res.json()) as EbayTokenResponse;
}

/** Exchanges an authorization code (from the consent redirect) for tokens and stores them. */
export async function exchangeAuthorizationCode(userId: string, code: string): Promise<void> {
  const { ruName } = getCredentials();
  const token = await requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: ruName,
    }),
  );
  if (!token.refresh_token) {
    throw new EbayApiError('eBay did not return a refresh_token for this authorization code');
  }
  await upsertTokens(userId, token.access_token, token.refresh_token, token.expires_in);
}

async function upsertTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  // Encrypt at the application layer before the token ever reaches the DB —
  // these grant live write access to a real eBay seller account. Never log
  // accessToken/refreshToken (plaintext) anywhere above or below this line.
  const encryptedAccessToken = encryptToken(accessToken);
  const encryptedRefreshToken = encryptToken(refreshToken);
  await getDb()
    .insert(schema.ebayAccounts)
    .values({
      user_id: userId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      access_token_expires_at: expiresAt,
    })
    .onConflictDoUpdate({
      target: schema.ebayAccounts.user_id,
      set: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        access_token_expires_at: expiresAt,
        updated_at: new Date(),
      },
    });
}

const EXPIRY_SAFETY_MARGIN_MS = 60_000; // refresh 60s before actual expiry

/**
 * Returns a valid eBay access token for this user, refreshing it first if
 * it's expired/near-expiry. Throws EbayNotConnectedError if the user has
 * never connected an eBay account.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const [row] = await getDb()
    .select()
    .from(schema.ebayAccounts)
    .where(eq(schema.ebayAccounts.user_id, userId));

  if (!row) {
    throw new EbayNotConnectedError();
  }

  // Decrypted only here, at the point of use — never returned/logged
  // anywhere else in this module.
  const decryptedAccessToken = decryptToken(row.access_token);
  const decryptedRefreshToken = decryptToken(row.refresh_token);

  const isExpired = row.access_token_expires_at.getTime() - EXPIRY_SAFETY_MARGIN_MS <= Date.now();
  if (!isExpired) {
    return decryptedAccessToken;
  }

  const refreshed = await requestToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptedRefreshToken,
      scope: SELL_SCOPE,
    }),
  );
  await upsertTokens(userId, refreshed.access_token, refreshed.refresh_token ?? decryptedRefreshToken, refreshed.expires_in);
  return refreshed.access_token;
}

// ── App-level (client credentials) token — for read-only reference data ───
// The Taxonomy API's category/aspect data is public reference data, not
// seller-specific, so it uses eBay's client_credentials grant rather than a
// per-user token. Cached in module scope with a small expiry buffer —
// short-lived (module lifetime of a single serverless invocation), refetched
// when stale rather than persisted, since it's not tied to any one user.
let _appToken: { token: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  if (_appToken && _appToken.expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return _appToken.token;
  }
  const token = await requestToken(
    new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  );
  _appToken = { token: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return token.access_token;
}

export async function isEbayConnected(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: schema.ebayAccounts.id })
    .from(schema.ebayAccounts)
    .where(and(eq(schema.ebayAccounts.user_id, userId)));
  return !!row;
}
