// eBay Inventory API wrapper, per plan.md §6 "eBay Integration".
// Exports createOrReplaceInventoryItem() only — this module has no concept
// of offers/publishing (that's offerApi.ts's job, kept strictly separate).

import { getEbayApiBase, EbayApiError } from './config';

export interface InventoryItemPayload {
  sku: string;
  product: {
    title: string;
    description?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
  };
  condition: 'NEW' | 'USED_EXCELLENT' | 'USED_GOOD' | 'USED_ACCEPTABLE';
  availability: {
    shipToLocationAvailability: { quantity: number };
  };
}

/**
 * PUT /sell/inventory/v1/inventory_item/{sku} — creates or replaces the
 * inventory-item record for a card. Idempotent by SKU (eBay's semantics),
 * so safe to call again if a draft's fields change before an offer exists.
 */
export async function createOrReplaceInventoryItem(
  accessToken: string,
  payload: InventoryItemPayload,
): Promise<void> {
  const res = await fetch(`${getEbayApiBase()}/sell/inventory/v1/inventory_item/${encodeURIComponent(payload.sku)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify({
      product: payload.product,
      condition: payload.condition,
      availability: payload.availability,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EbayApiError(`createOrReplaceInventoryItem failed (${res.status})`, res.status, body);
  }
}
