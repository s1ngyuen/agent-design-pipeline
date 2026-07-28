"use client";

import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

export interface DashboardStats {
  counts_by_status: Record<string, number>;
  total_cards: number;
  inventory_estimated_value: number;
  inventory_acquisition_cost: number;
  sales: {
    count: number;
    total_sale_price: number;
    total_net_profit: number;
    total_fees: number;
    total_shipping: number;
  };
}

export function useDashboardStats() {
  const { data, error, isLoading } = useSWR<DashboardStats>("/api/dashboard/stats", swrFetcher);
  return { stats: data, error, isLoading };
}
