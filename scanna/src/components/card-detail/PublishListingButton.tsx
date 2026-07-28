"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { publishListing, type EbayListing } from "@/hooks/useEbayListings";
import { ApiError } from "@/lib/api";

/**
 * THE one irreversible action in the whole app (content.md). This is a
 * completely separate component from CreateDraftListingButton/
 * DraftListingPanel — separate file, separate render tree, separate API
 * call (publishListing() from src/hooks/useEbayListings.ts, which is the
 * only frontend function that hits POST /api/ebay/listings/[id]/publish,
 * itself the only backend route that calls publishOffer()). There is no
 * code path from "create draft" to "published" that skips this
 * component's own explicit confirmation dialog.
 *
 * Only rendered by the parent when a draft-status listing exists — see
 * CardDetailPageClient.
 */
export function PublishListingButton({ listing, onPublished }: { listing: EbayListing; onPublished: (l: EbayListing) => void }) {
  const { showToast } = useToast();
  const titleId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);

  async function handleConfirmPublish() {
    setPublishing(true);
    setFailure(null);
    setVersionConflict(false);
    try {
      const updated = await publishListing(listing.id, listing.version);
      // Same copy as the "Live on eBay" panel CardDetailPageClient renders
      // right after this (that panel is the more detailed, canonical
      // version) — previously this toast said only "Live on eBay" while the
      // panel said the fuller sentence below, which read as two different
      // messages for the same event.
      showToast("Your listing is now public. Buyers can find and bid on or buy this card starting now.", "success");
      setConfirmOpen(false);
      onPublished(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setVersionConflict(true);
      } else {
        setFailure(
          "Something went wrong on eBay's end and the listing wasn't published. Your draft is untouched — check your eBay account connection and try again.",
        );
      }
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border-2 border-plum bg-plum-soft p-4">
        <p className="text-sm font-semibold text-ink">Ready to go live?</p>
        <p className="mt-1 text-xs text-ink-70">
          Publishing is the one step in Scanna that can&apos;t be undone from here.
        </p>
        <Button type="button" variant="plum" size="lg" className="mt-3 w-full" onClick={() => setConfirmOpen(true)}>
          Publish to eBay
        </Button>
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} titleId={titleId}>
        <h2 id={titleId} className="font-heading text-lg font-semibold text-ink">
          Publish this listing to eBay?
        </h2>
        <p className="mt-2 text-sm text-ink-70">
          This is the one step that actually goes live. Once you publish, your listing becomes visible to real
          buyers on eBay immediately, and this can&apos;t be undone from here — you&apos;d need to end or
          revise the listing on eBay itself afterward.
        </p>
        <p className="mt-2 text-sm text-ink-70">Double-check the title, price, and photos below before continuing. Everything up to this point has been a draft only.</p>

        <dl className="mt-4 rounded-lg bg-bone-100 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-70">Title</dt>
            <dd className="text-right text-ink">{listing.title}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <dt className="text-ink-70">Buy It Now</dt>
            <dd className="font-mono text-ink">{listing.buy_now_price ? `$${Number(listing.buy_now_price).toFixed(2)}` : "—"}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <dt className="text-ink-70">Category</dt>
            <dd className="text-ink">{listing.category_id ?? "—"}</dd>
          </div>
        </dl>

        {versionConflict && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            This draft changed somewhere else since you last loaded it. Refresh to see the latest version
            before publishing.
          </p>
        )}
        {failure && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {failure}
          </p>
        )}

        {publishing && <p className="mt-3 text-sm font-medium text-ink">Publishing to eBay...</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Not yet — keep as draft
          </Button>
          <Button variant="plum" onClick={handleConfirmPublish} loading={publishing}>
            Yes, publish this listing
          </Button>
        </div>
      </Dialog>
    </>
  );
}
