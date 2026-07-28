"use client";

import Link from "next/link";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useSales } from "@/hooks/useSales";
import { StatCard } from "@/components/dashboard/StatCard";
import { SalesHistoryTable } from "@/components/dashboard/SalesHistoryTable";
import { Button } from "@/components/ui/Button";

export function DashboardPageClient() {
  const { stats, isLoading } = useDashboardStats();
  const { sales } = useSales();

  const noInventory = stats && stats.total_cards === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-70">A quick read on where your business stands right now.</p>
      </div>

      {isLoading || !stats ? (
        <p className="text-sm text-ink-50">Loading…</p>
      ) : noInventory ? (
        <div className="rounded-xl border border-border bg-paper p-8 text-center">
          <p className="text-sm text-ink-70">Nothing to show yet. Scan or add your first card to start seeing your numbers here.</p>
          <Link href="/scan" className="mt-4 inline-block">
            <Button variant="accent">Scan a Card</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="Total Inventory Value"
              value={`$${stats.inventory_estimated_value.toFixed(2)}`}
              hint="Sum of current estimates across all in-stock and listed cards."
            />
            <StatCard
              label="Total Profit"
              value={`$${stats.sales.total_net_profit.toFixed(2)}`}
              hint="Realized profit from everything sold so far."
            />
            <StatCard label="In Stock" value={String(stats.counts_by_status["in-stock"] ?? 0)} />
            <StatCard label="Listed" value={String(stats.counts_by_status.listed ?? 0)} />
            <StatCard label="Sold" value={String(stats.counts_by_status.sold ?? 0)} />
          </div>

          <section>
            <h2 className="font-heading text-lg font-semibold text-ink">Sales History</h2>
            <div className="mt-2">
              <SalesHistoryTable sales={sales} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
