// eBay Taxonomy API wrapper, per plan.md §6 "eBay Integration" — supplies
// category-correct item aspects for draft-listing pre-fill. Read-only
// reference data, so it uses the app-level client_credentials token
// (getAppAccessToken), not a per-user token.

import { getAppAccessToken } from './auth';
import { getEbayApiBase, EbayApiError } from './config';

const DEFAULT_MARKETPLACE = 'EBAY_US';

// Category tree IDs rarely change — cache per marketplace for the life of
// this module instance rather than re-fetching on every call.
const categoryTreeIdCache = new Map<string, string>();

async function getDefaultCategoryTreeId(marketplaceId: string): Promise<string> {
  const cached = categoryTreeIdCache.get(marketplaceId);
  if (cached) return cached;

  const token = await getAppAccessToken();
  const res = await fetch(
    `${getEbayApiBase()}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplaceId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EbayApiError(`get_default_category_tree_id failed (${res.status})`, res.status, body);
  }
  const json = (await res.json()) as { categoryTreeId: string };
  categoryTreeIdCache.set(marketplaceId, json.categoryTreeId);
  return json.categoryTreeId;
}

export interface ItemAspect {
  localizedAspectName: string;
  aspectConstraint: { aspectRequired: boolean; aspectMode: string };
  aspectValues?: { localizedValue: string }[];
}

/** GET .../category_tree/{treeId}/get_item_aspects_for_category — proxied by GET /api/ebay/aspects. */
export async function getItemAspectsForCategory(
  categoryId: string,
  marketplaceId: string = DEFAULT_MARKETPLACE,
): Promise<ItemAspect[]> {
  const token = await getAppAccessToken();
  const treeId = await getDefaultCategoryTreeId(marketplaceId);

  const res = await fetch(
    `${getEbayApiBase()}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EbayApiError(`get_item_aspects_for_category failed (${res.status})`, res.status, body);
  }
  const json = (await res.json()) as { aspects?: ItemAspect[] };
  return json.aspects ?? [];
}
