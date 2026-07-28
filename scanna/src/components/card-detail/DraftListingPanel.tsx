"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { patchDraftListing, type EbayListing } from "@/hooks/useEbayListings";
import { validatePrice } from "@/lib/validation/cardForm";
import { ApiError } from "@/lib/api";

/**
 * Draft-state editor — content.md "After draft creation — draft state
 * panel." This is the routine, reversible half of the eBay section; it
 * calls PATCH /api/ebay/listings/[id] only. PublishListingButton is a
 * completely separate component/file rendered alongside this one, never
 * merged into it (see that file's own comment).
 */
export function DraftListingPanel({ listing, onUpdated }: { listing: EbayListing; onUpdated: (l: EbayListing) => void }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(listing.title);
  const [startPrice, setStartPrice] = useState(listing.start_price ?? "");
  const [buyNowPrice, setBuyNowPrice] = useState(listing.buy_now_price ?? "");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (buyNowPrice.toString().trim()) {
      const err = validatePrice(String(buyNowPrice));
      if (err) {
        setError(err);
        return;
      }
    }
    setError(undefined);
    setSaving(true);
    try {
      const updated = await patchDraftListing(listing.id, listing.version, {
        title: title.trim(),
        start_price: startPrice.toString().trim() ? Number(startPrice) : null,
        buy_now_price: buyNowPrice.toString().trim() ? Number(buyNowPrice) : null,
      });
      showToast("Draft updated.", "success");
      onUpdated(updated);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-paper p-4">
      <h3 className="font-heading text-base font-semibold text-ink">Draft ready — not live yet</h3>
      <p className="mt-1 text-sm text-ink-70">
        This draft exists only inside Scanna and your eBay seller account&apos;s unpublished offers — buyers
        can&apos;t see it. Review the details below, then publish when you&apos;re ready to go live.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <TextField label="Listing title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField
          label="Start price"
          placeholder="$0.00"
          inputMode="decimal"
          value={startPrice}
          onChange={(e) => setStartPrice(e.target.value)}
          hint="Leave blank for a fixed-price listing."
        />
        <TextField
          label="Buy It Now price"
          placeholder="$0.00"
          inputMode="decimal"
          value={buyNowPrice}
          onChange={(e) => setBuyNowPrice(e.target.value)}
          hint="Pre-filled from the value estimate — you can change it."
          error={error}
        />
      </div>
      <Button className="mt-4" variant="primary" onClick={handleSave} loading={saving}>
        Save Draft
      </Button>
    </div>
  );
}
