"use client";

import useSWR from "swr";
import { apiFetch, swrFetcher, ApiError } from "@/lib/api";
import type { CardAttributes, ValueEstimate } from "@/domain/types";

export interface Card extends CardAttributes {
  id: string;
  user_id: string;
  photos: string[];
  acquisition_price: string;
  acquisition_date: string;
  status: "in-stock" | "listed" | "sold";
  estimated_value: string | null;
  value_estimate_detail: ValueEstimate | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CardFilters {
  status?: string;
  sport?: string;
  q?: string;
}

function buildQuery(filters: CardFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.sport) params.set("sport", filters.sport);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useCards(filters: CardFilters = {}) {
  const key = `/api/cards${buildQuery(filters)}`;
  const { data, error, isLoading, mutate } = useSWR<Card[]>(key, swrFetcher);
  return { cards: data ?? [], error, isLoading, mutate, key };
}

export function useCard(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Card>(id ? `/api/cards/${id}` : null, swrFetcher);
  return { card: data, error, isLoading, mutate };
}

export type CreateCardInput = CardAttributes & {
  photos?: string[];
  acquisition_price: number;
  acquisition_date: string;
  notes?: string | null;
  estimate?: ValueEstimate | null;
};

export function createCard(input: CreateCardInput): Promise<Card> {
  return apiFetch<Card>("/api/cards", { method: "POST", body: JSON.stringify(input) });
}

// Wire shape for PATCH /api/cards/[id] — distinct from the `Card` read
// model, whose numeric fields come back from Postgres as strings. The
// route's zod schema (src/app/api/cards/[id]/route.ts) expects real numbers
// for grade/acquisition_price.
export interface PatchCardInput {
  sport?: CardAttributes["sport"];
  league?: string | null;
  player?: string;
  team?: string;
  year?: string;
  manufacturer?: string;
  product?: string;
  card_number?: string;
  parallel_name?: string | null;
  print_run?: number | null;
  is_auto?: boolean;
  is_rookie?: boolean;
  condition?: CardAttributes["condition"];
  grade?: number | null;
  grader?: CardAttributes["grader"];
  photos?: string[];
  acquisition_price?: number;
  acquisition_date?: string;
  status?: Card["status"];
  notes?: string | null;
}

export function patchCard(id: string, expectedVersion: number, fields: PatchCardInput): Promise<Card> {
  return apiFetch<Card>(`/api/cards/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ expectedVersion, ...fields }),
  });
}

export function deleteCard(id: string): Promise<{ deleted: true }> {
  return apiFetch(`/api/cards/${id}`, { method: "DELETE" });
}

export function reEstimateCard(id: string, expectedVersion: number): Promise<Card> {
  return apiFetch<Card>(`/api/cards/${id}/estimate`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  });
}

export { ApiError };
