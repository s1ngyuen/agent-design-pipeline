"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScanAndReviewFlow } from "@/components/scan/ScanAndReviewFlow";
import { ScanNextButton } from "@/components/review/ScanNextButton";
import { ValueEstimateBreakdown } from "@/components/card-detail/ValueEstimateBreakdown";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { createCard, ApiError, type CreateCardInput } from "@/hooks/useCards";
import type { CardAttributes, ValueEstimate } from "@/domain/types";
import type { AcquisitionInput } from "@/components/review/ManualCorrectionForm";

// One "card saved this session" flag, kept in module scope so the helper
// microcopy under Scan Next only shows the first time in a session (per
// content.md: "shown briefly after first save in a session"). Resets on a
// full page reload, which is fine — it's a one-time hint, not a setting.
let hasSavedThisSession = false;

interface PendingCard {
  attrs: CardAttributes;
  estimate: ValueEstimate | null;
  acquisition?: AcquisitionInput;
}

export function ScanPageClient() {
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const { enqueue } = useOfflineQueue();
  const searchParams = useSearchParams();
  const startInManualEntry = searchParams.get("manual") === "1";
  const [saved, setSaved] = useState(false);
  const [firstSave] = useState(!hasSavedThisSession);
  const [flowKey, setFlowKey] = useState(0);
  const [pending, setPending] = useState<PendingCard | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveCard(input: CreateCardInput) {
    if (!online) {
      await enqueue({ method: "POST", url: "/api/cards", body: input, kind: "card", label: `${input.player} card` });
    } else {
      await createCard(input);
    }
    hasSavedThisSession = true;
    showToast("Card saved to your Collection.", "success");
    setSaved(true);
  }

  // Offline, no estimate was ever possible (no connection to price it with)
  // — nothing to review, so save immediately rather than "pending" a price
  // screen with no price on it. Online, this is a "Calculate Price" result
  // the user reviews before choosing to add it — never an automatic save,
  // same separation Research already had (Get Value Estimate, then a
  // distinct Add to Inventory button) that Collection was missing.
  async function handleReady(attrs: CardAttributes, estimate: ValueEstimate | null, acquisition?: AcquisitionInput) {
    if (!online) {
      const input: CreateCardInput = {
        ...attrs,
        photos: [],
        acquisition_price: acquisition?.acquisition_price ?? 0,
        acquisition_date: acquisition?.acquisition_date ?? new Date().toISOString().slice(0, 10),
        estimate,
      };
      try {
        await saveCard(input);
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
        setFlowKey((k) => k + 1);
      }
      return;
    }
    setPending({ attrs, estimate, acquisition });
  }

  async function handleAddToCollection() {
    if (!pending) return;
    setSaving(true);
    const input: CreateCardInput = {
      ...pending.attrs,
      photos: [],
      acquisition_price: pending.acquisition?.acquisition_price ?? 0,
      acquisition_date: pending.acquisition?.acquisition_date ?? new Date().toISOString().slice(0, 10),
      estimate: pending.estimate,
    };
    try {
      await saveCard(input);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
      setPending(null);
      setFlowKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <p className="font-heading text-2xl font-semibold text-ink">Card saved to your Collection.</p>
        <div className="w-full max-w-xs md:max-w-sm lg:max-w-md">
          <ScanNextButton firstInSession={firstSave} />
        </div>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-paper p-4">
          <p className="font-heading text-lg font-semibold text-ink">
            {pending.attrs.year} {pending.attrs.manufacturer} {pending.attrs.product} — {pending.attrs.player}
          </p>
          {pending.estimate && <ValueEstimateBreakdown estimate={pending.estimate} />}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button variant="accent" size="lg" loading={saving} onClick={handleAddToCollection}>
            Add to Collection
          </Button>
          <Button variant="ghost" onClick={() => { setPending(null); setFlowKey((k) => k + 1); }}>
            Discard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center font-heading text-xl font-semibold text-ink">Scan a card</h1>
      <ScanAndReviewFlow
        key={flowKey}
        requireAcquisition
        saveLabel="Calculate Price"
        onReady={handleReady}
        startInManualEntry={flowKey === 0 && startInManualEntry}
      />
    </div>
  );
}
