"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScanAndReviewFlow } from "@/components/scan/ScanAndReviewFlow";
import { ScanNextButton } from "@/components/review/ScanNextButton";
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

export function ScanPageClient() {
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const { enqueue } = useOfflineQueue();
  const searchParams = useSearchParams();
  const startInManualEntry = searchParams.get("manual") === "1";
  const [saved, setSaved] = useState(false);
  const [firstSave] = useState(!hasSavedThisSession);
  const [flowKey, setFlowKey] = useState(0);

  async function handleReady(attrs: CardAttributes, estimate: ValueEstimate | null, acquisition?: AcquisitionInput) {
    const input: CreateCardInput = {
      ...attrs,
      photos: [],
      acquisition_price: acquisition?.acquisition_price ?? 0,
      acquisition_date: acquisition?.acquisition_date ?? new Date().toISOString().slice(0, 10),
      estimate,
    };

    try {
      if (!online) {
        await enqueue({ method: "POST", url: "/api/cards", body: input, kind: "card", label: `${attrs.player} card` });
      } else {
        await createCard(input);
      }
      hasSavedThisSession = true;
      showToast("Card saved to your Collection.", "success");
      setSaved(true);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
      setFlowKey((k) => k + 1);
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center font-heading text-xl font-semibold text-ink">Scan a card</h1>
      <ScanAndReviewFlow
        key={flowKey}
        requireAcquisition
        saveLabel="Save to Collection"
        onReady={handleReady}
        startInManualEntry={flowKey === 0 && startInManualEntry}
      />
    </div>
  );
}
