"use client";

import { useState } from "react";
import { ScanAndReviewFlow } from "@/components/scan/ScanAndReviewFlow";
import { ValueEstimateBreakdown } from "@/components/card-detail/ValueEstimateBreakdown";
import { AskingPriceInput } from "@/components/research/AskingPriceInput";
import { AddToInventoryButton } from "@/components/research/AddToInventoryButton";
import { RecentlyLookedUpList } from "@/components/research/RecentlyLookedUpList";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useLookups, createLookup, patchLookupAskingPrice, patchLookupEstimate, type Lookup } from "@/hooks/useLookups";
import { estimateValue } from "@/lib/clientPipeline";
import { ApiError } from "@/lib/api";
import type { CardAttributes, ValueEstimate } from "@/domain/types";

export function ResearchPageClient() {
  const { showToast } = useToast();
  const { lookups, mutate } = useLookups(20);
  const [result, setResult] = useState<Lookup | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ cached: boolean; cachedAt: string | null } | null>(null);
  const [flowKey, setFlowKey] = useState(0);
  const [checking, setChecking] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  async function handleReady(
    attrs: CardAttributes,
    estimate: ValueEstimate | null,
    _acquisition?: unknown,
    cacheMeta?: { cached: boolean; cachedAt: string | null },
  ) {
    // Research always needs a real estimate — it's the entire point of a
    // lookup, and POST /api/lookups requires one server-side — so this
    // should only ever be reached with a non-null estimate in practice
    // (ScanAndReviewFlow only skips straight to a null estimate on the
    // Collection/requireAcquisition path). Guard anyway rather than crash.
    if (!estimate) {
      showToast("Couldn't connect. Check your connection and try again.", "error");
      return;
    }
    try {
      const lookup = await createLookup({ ...attrs, estimate, asking_price: null });
      setResult(lookup);
      setCacheInfo(cacheMeta ?? null);
      mutate();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
    }
  }

  async function handleRecalculate() {
    if (!result) return;
    setRecalculating(true);
    try {
      const { estimate, cached, cachedAt } = await estimateValue(result, { forceRecalculate: true });
      const updated = await patchLookupEstimate(result.id, estimate);
      setResult(updated);
      setCacheInfo({ cached, cachedAt });
      mutate();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't recalculate — try again.", "error");
    } finally {
      setRecalculating(false);
    }
  }

  async function handleCheckPrice(price: number) {
    if (!result) return;
    setChecking(true);
    try {
      const updated = await patchLookupAskingPrice(result.id, price);
      setResult(updated);
      mutate();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
    } finally {
      setChecking(false);
    }
  }

  function lookAgain() {
    setResult(null);
    setCacheInfo(null);
    setFlowKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Check a card before you buy it</h1>
        <p className="mt-1 text-sm text-ink-70">
          This is a quick look, not a commitment. Scan a card at a shop or show, see what it&apos;s worth, and
          decide — nothing gets saved to your inventory unless you choose to add it.
        </p>
      </div>

      {result ? (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-paper p-4">
            <p className="font-heading text-lg font-semibold text-ink">
              {result.year} {result.manufacturer} {result.product} — {result.player}
            </p>
            {result.value_estimate_detail && (
              <>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {cacheInfo?.cached ? (
                    <Badge tone="slate">
                      Cached{cacheInfo.cachedAt ? ` from ${new Date(cacheInfo.cachedAt).toLocaleDateString()}` : ""}
                    </Badge>
                  ) : (
                    <span />
                  )}
                  <Button variant="ghost" size="sm" loading={recalculating} onClick={handleRecalculate}>
                    Recalculate
                  </Button>
                </div>
                <ValueEstimateBreakdown estimate={result.value_estimate_detail} />
              </>
            )}
          </div>

          <AskingPriceInput
            askingPrice={result.asking_price != null ? Number(result.asking_price) : null}
            buySignal={result.buy_signal}
            onCheck={handleCheckPrice}
            checking={checking}
          />

          <div className="flex items-center justify-between gap-3">
            <AddToInventoryButton lookupId={result.id} onConverted={() => mutate()} />
            <Button variant="ghost" onClick={lookAgain}>
              Look up another card
            </Button>
          </div>
        </div>
      ) : (
        <ScanAndReviewFlow
          key={flowKey}
          requireAcquisition={false}
          saveLabel="Get Value Estimate"
          onReady={handleReady}
        />
      )}

      <RecentlyLookedUpList lookups={lookups} onConverted={() => mutate()} />
    </div>
  );
}
