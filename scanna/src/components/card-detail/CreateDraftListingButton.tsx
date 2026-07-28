"use client";

import { useId, useState } from "react";
import useSWR from "swr";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { createDraftListing, type EbayListing } from "@/hooks/useEbayListings";
import { validatePrice } from "@/lib/validation/cardForm";
import { apiFetch, ApiError } from "@/lib/api";
import type { Card } from "@/hooks/useCards";
import type { Sport } from "@/domain/types";

// Starting list of eBay's US sports-card leaf categories, keyed to the
// sports Scanna supports. There's no category-*search* endpoint on eBay's
// Taxonomy API (GET /api/ebay/aspects only resolves item aspects for a
// category ID you already have) — so this is a hand-picked list rather
// than something looked up live. IDs should be reverified against eBay's
// live category tree before this ships to real listings; treat them as a
// starting point the user consciously confirms, not a guaranteed match.
const CUSTOM_CATEGORY = "__custom__";

interface CategoryOption {
  value: string;
  label: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "261328", label: "Football Cards" },
  { value: "261329", label: "Basketball Cards" },
  { value: "183050", label: "Soccer Cards" },
  { value: "212", label: "Sports Trading Cards (general)" },
  { value: CUSTOM_CATEGORY, label: "Other — enter a category ID" },
];

const DEFAULT_CATEGORY_BY_SPORT: Record<Sport, string> = {
  NFL: "261328",
  NBA: "261329",
  Soccer: "183050",
  // No confident UFC-specific leaf category in this starting list — land
  // on the general category and let the user confirm/change it rather
  // than guess at a sport-specific ID we're not sure exists.
  UFC: "212",
};

interface AspectsResponse {
  aspects: { localizedAspectName: string; aspectConstraint: { aspectRequired: boolean } }[];
}

/** Fetches GET /api/ebay/aspects for the selected category, purely to give
 * the user a signal on whether eBay actually recognizes that category ID —
 * a 502/error here means the ID is probably wrong and worth double-checking
 * before creating the draft. Informational only; not submitted anywhere. */
function useCategoryCheck(categoryId: string) {
  const key = categoryId && categoryId !== CUSTOM_CATEGORY ? `/api/ebay/aspects?category_id=${encodeURIComponent(categoryId)}` : null;
  const { data, error, isLoading } = useSWR<AspectsResponse>(key, (url: string) => apiFetch<AspectsResponse>(url));
  return { aspects: data?.aspects ?? [], checking: isLoading, failed: !!error };
}

function autoTitle(card: Card): string {
  const parts = [
    card.year,
    card.manufacturer,
    card.product,
    card.player,
    card.card_number,
    card.parallel_name,
    card.is_auto ? "Auto" : null,
    card.is_rookie ? "RC" : null,
  ].filter(Boolean);
  return parts.join(" ").slice(0, 80);
}

/**
 * The reversible, routine half of the eBay flow — creates a DRAFT only
 * (POST /api/ebay/listings, which calls createOffer() and stops — see that
 * route's own comment). Deliberately styled and behaviourally distinct from
 * PublishListingButton: different component, different API call, no
 * confirmation dialog needed since nothing goes live here.
 */
export function CreateDraftListingButton({ card, onCreated }: { card: Card; onCreated: (listing: EbayListing) => void }) {
  const { showToast } = useToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(() => autoTitle(card));
  const [buyNowPrice, setBuyNowPrice] = useState(card.estimated_value ? Number(card.estimated_value).toFixed(2) : "");
  const [startPrice, setStartPrice] = useState("");
  const initialCategory = DEFAULT_CATEGORY_BY_SPORT[card.sport] ?? "212";
  const [categorySelection, setCategorySelection] = useState(initialCategory);
  const [customCategoryId, setCustomCategoryId] = useState("");
  const categoryId = categorySelection === CUSTOM_CATEGORY ? customCategoryId.trim() : categorySelection;
  const { aspects, checking: checkingCategory, failed: categoryCheckFailed } = useCategoryCheck(categoryId);
  const [error, setError] = useState<string | undefined>();
  const [categoryError, setCategoryError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!categoryId) {
      setCategoryError("Enter a category ID.");
      return;
    }
    setCategoryError(undefined);
    if (!buyNowPrice.trim() && !startPrice.trim()) {
      setError("Enter a Buy It Now price, a Start price, or both.");
      return;
    }
    if (buyNowPrice.trim()) {
      const err = validatePrice(buyNowPrice);
      if (err) {
        setError(err);
        return;
      }
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const listing = await createDraftListing({
        card_id: card.id,
        title: title.trim(),
        buy_now_price: buyNowPrice.trim() ? Number(buyNowPrice) : null,
        start_price: startPrice.trim() ? Number(startPrice) : null,
        category_id: categoryId,
      });
      showToast("Saved.", "success");
      setOpen(false);
      onCreated(listing);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div>
        <Button type="button" variant="primary" onClick={() => setOpen(true)}>
          Create Draft Listing
        </Button>
        <p className="mt-1 text-xs text-ink-50">This only prepares a draft. It won&apos;t be visible on eBay until you publish it separately.</p>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} titleId={titleId}>
        <h2 id={titleId} className="font-heading text-lg font-semibold text-ink">
          Create Draft Listing
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Listing title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            hint="Auto-filled from the card's details. Edit it however you like before publishing."
          />
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
          <div>
            <SelectField
              label="Category"
              required
              options={CATEGORY_OPTIONS}
              value={categorySelection}
              onChange={(e) => setCategorySelection(e.target.value)}
              hint="Pre-selected from the card's sport — check it matches before creating the draft."
            />
            {categorySelection === CUSTOM_CATEGORY && (
              <div className="mt-3">
                <TextField
                  label="Category ID"
                  value={customCategoryId}
                  onChange={(e) => setCustomCategoryId(e.target.value)}
                  placeholder="e.g. 213"
                  error={categoryError}
                />
              </div>
            )}
            {categoryId && (
              <p className="mt-1.5 text-xs text-ink-50">
                {checkingCategory
                  ? "Checking this category with eBay…"
                  : categoryCheckFailed
                    ? "Couldn't confirm this category ID with eBay — double-check it before creating the draft."
                    : aspects.length > 0
                      ? `eBay expects ${aspects.filter((a) => a.aspectConstraint.aspectRequired).length || aspects.length} detail${aspects.length === 1 ? "" : "s"} for this category (e.g. ${aspects
                          .slice(0, 3)
                          .map((a) => a.localizedAspectName)
                          .join(", ")}).`
                      : "eBay didn't return any specific requirements for this category."}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={submitting}>
            Create Draft Listing
          </Button>
        </div>
      </Dialog>
    </>
  );
}
