// eBay Offer API wrapper, per plan.md §6 "eBay Integration" — the hard
// requirement: createOffer() and publishOffer() are separate exported
// functions and MUST NEVER be called from the same request handler.
// createOffer() is called by POST /api/ebay/listings (draft creation
// only). publishOffer() is called ONLY by
// POST /api/ebay/listings/[id]/publish — grep this codebase for
// `publishOffer(` to confirm that route is its single call site.

import { getEbayApiBase, EbayApiError } from './config';

export interface CreateOfferPayload {
  sku: string;
  marketplaceId: string; // e.g. "EBAY_US"
  format: 'FIXED_PRICE';
  categoryId: string;
  listingDescription: string;
  pricingSummary: {
    price: { value: string; currency: string };
  };
  merchantLocationKey: string;
}

export interface CreateOfferResult {
  offerId: string;
}

/**
 * POST /sell/inventory/v1/offer — creates a draft offer against an
 * existing inventory item. Does NOT publish it. This function must never
 * be followed by a call to publishOffer() within the same request handler
 * — draft creation and publishing are two independently user-triggered
 * actions (brief.md's manual publish gate).
 */
export async function createOffer(accessToken: string, payload: CreateOfferPayload): Promise<CreateOfferResult> {
  const res = await fetch(`${getEbayApiBase()}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EbayApiError(`createOffer failed (${res.status})`, res.status, body);
  }

  const json = (await res.json()) as { offerId: string };
  return { offerId: json.offerId };
}

export interface PublishOfferResult {
  listingId: string;
}

/**
 * POST /sell/inventory/v1/offer/{offerId}/publish — makes the listing
 * LIVE on eBay. This is the one irreversible action in the flow (brief.md).
 * Called ONLY from POST /api/ebay/listings/[id]/publish, never from draft
 * creation.
 */
export async function publishOffer(accessToken: string, offerId: string): Promise<PublishOfferResult> {
  const res = await fetch(`${getEbayApiBase()}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EbayApiError(`publishOffer failed (${res.status})`, res.status, body);
  }

  const json = (await res.json()) as { listingId: string };
  return { listingId: json.listingId };
}

export interface GetOfferResult {
  offerId: string;
  status: string;
  listing?: { listingId?: string };
}

/** GET /sell/inventory/v1/offer/{offerId} — used by /api/ebay/sync for status polling. */
export async function getOffer(accessToken: string, offerId: string): Promise<GetOfferResult> {
  const res = await fetch(`${getEbayApiBase()}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EbayApiError(`getOffer failed (${res.status})`, res.status, body);
  }
  return (await res.json()) as GetOfferResult;
}
