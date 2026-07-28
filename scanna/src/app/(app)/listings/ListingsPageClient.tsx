"use client";

import Link from "next/link";
import { useEbayListings } from "@/hooks/useEbayListings";
import { ListingsTable } from "@/components/listings/ListingsTable";
import { SyncButton } from "@/components/listings/SyncButton";
import { Button } from "@/components/ui/Button";

export function ListingsPageClient() {
  const { listings, isLoading, mutate } = useEbayListings();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Your eBay Listings</h1>
          <p className="text-sm text-ink-70">Everything you&apos;ve published, with status and stats synced from eBay.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/ebay/oauth/start">
            <Button type="button" variant="secondary">
              Connect eBay
            </Button>
          </a>
          <SyncButton onSynced={() => mutate()} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-50">Loading…</p>
      ) : listings.length === 0 ? (
        <div className="rounded-xl border border-border bg-paper p-8 text-center">
          <p className="font-heading text-lg font-semibold text-ink">No listings yet</p>
          <p className="mt-1 text-sm text-ink-70">Once you publish a card from its Card Detail page, it&apos;ll show up here with live status, views, and watchers.</p>
          <Link href="/collection" className="mt-4 inline-block">
            <Button variant="accent">Go to Collection</Button>
          </Link>
        </div>
      ) : (
        <ListingsTable listings={listings} />
      )}
    </div>
  );
}
