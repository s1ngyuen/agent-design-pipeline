"use client";

import useSWR from "swr";
import { apiFetch, swrFetcher } from "@/lib/api";
import type { CardAttributes, ValueEstimate, BuySignal } from "@/domain/types";
import type { Card } from "./useCards";

export interface Lookup extends CardAttributes {
  id: string;
  user_id: string;
  estimated_value: string | null;
  value_estimate_detail: ValueEstimate | null;
  looked_up_at: string;
  asking_price: string | null;
  buy_signal: BuySignal | null;
  converted_card_id: string | null;
  created_at: string;
}

export function useLookups(limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<Lookup[]>(`/api/lookups?limit=${limit}`, swrFetcher);
  return { lookups: data ?? [], error, isLoading, mutate };
}

export type CreateLookupInput = CardAttributes & {
  estimate: ValueEstimate;
  asking_price?: number | null;
};

export function createLookup(input: CreateLookupInput): Promise<Lookup> {
  return apiFetch<Lookup>("/api/lookups", { method: "POST", body: JSON.stringify(input) });
}

export function patchLookupAskingPrice(id: string, asking_price: number | null): Promise<Lookup> {
  return apiFetch<Lookup>(`/api/lookups/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ asking_price }),
  });
}

export function convertLookupToCard(
  id: string,
  acquisition_price: number,
  acquisition_date: string,
): Promise<Card> {
  return apiFetch<Card>(`/api/lookups/${id}/convert`, {
    method: "POST",
    body: JSON.stringify({ acquisition_price, acquisition_date }),
  });
}
