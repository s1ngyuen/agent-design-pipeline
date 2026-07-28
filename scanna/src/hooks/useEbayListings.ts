"use client";

import useSWR from "swr";
import { apiFetch, swrFetcher } from "@/lib/api";
import type { EbayListingStatus } from "@/domain/types";

export interface EbayListing {
  id: string;
  card_id: string;
  card_player?: string;
  ebay_listing_id: string | null;
  ebay_offer_id: string | null;
  sku: string | null;
  category_id: string | null;
  title: string;
  start_price: string | null;
  buy_now_price: string | null;
  status: EbayListingStatus;
  listed_date: string | null;
  ended_date: string | null;
  views: number | null;
  watchers: number | null;
  last_synced: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export function useEbayListings() {
  const { data, error, isLoading, mutate } = useSWR<EbayListing[]>("/api/ebay/listings", swrFetcher);
  return { listings: data ?? [], error, isLoading, mutate };
}

export interface CreateDraftListingInput {
  card_id: string;
  title: string;
  start_price?: number | null;
  buy_now_price?: number | null;
  category_id: string;
}

export function createDraftListing(input: CreateDraftListingInput): Promise<EbayListing> {
  return apiFetch<EbayListing>("/api/ebay/listings", { method: "POST", body: JSON.stringify(input) });
}

export function patchDraftListing(
  id: string,
  expectedVersion: number,
  fields: { title?: string; start_price?: number | null; buy_now_price?: number | null },
): Promise<EbayListing> {
  return apiFetch<EbayListing>(`/api/ebay/listings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ expectedVersion, ...fields }),
  });
}

/** The ONLY function in the frontend that calls the publish route — kept as
 * a separate, clearly-named export (mirrors lib/ebay/offerApi.ts's
 * createOffer/publishOffer separation server-side) so it's never accidentally
 * composed into the draft-creation call site. */
export function publishListing(id: string, expectedVersion: number): Promise<EbayListing> {
  return apiFetch<EbayListing>(`/api/ebay/listings/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  });
}

export function syncEbayListings(): Promise<{ synced: number; results: unknown[] }> {
  return apiFetch("/api/ebay/sync", { method: "POST", body: JSON.stringify({}) });
}
