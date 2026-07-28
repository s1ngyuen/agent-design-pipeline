"use client";

import useSWR from "swr";
import { apiFetch, swrFetcher } from "@/lib/api";
import type { SalePlatform, Sport } from "@/domain/types";

export interface Sale {
  id: string;
  card_id: string;
  ebay_listing_id: string | null;
  sale_price: string;
  sale_date: string;
  platform: SalePlatform;
  fees: string | null;
  shipping_cost: string | null;
  net_profit: string;
  buyer_notes: string | null;
  created_at: string;
  card_player: string;
  card_sport: Sport;
  card_year: string;
}

export function useSales() {
  const { data, error, isLoading, mutate } = useSWR<Sale[]>("/api/sales", swrFetcher);
  return { sales: data ?? [], error, isLoading, mutate };
}

export interface CreateSaleInput {
  card_id: string;
  ebay_listing_id?: string | null;
  sale_price: number;
  sale_date: string;
  platform: SalePlatform;
  fees?: number | null;
  shipping_cost?: number | null;
  buyer_notes?: string | null;
  expectedVersion: number;
}

export function createSale(input: CreateSaleInput): Promise<Sale> {
  return apiFetch<Sale>("/api/sales", { method: "POST", body: JSON.stringify(input) });
}
