"use client";

import { useEffect, useRef, useState } from "react";
import { CameraView, type ScanMode } from "./CameraView";
import { ScanModeToggle, type EntryMode } from "./ScanModeToggle";
import { CardSearchEntry } from "./CardSearchEntry";
import { IdentifiedCardSummary } from "@/components/review/IdentifiedCardSummary";
import { ManualCorrectionForm, type AcquisitionInput } from "@/components/review/ManualCorrectionForm";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { recognizeVision, recognizeCert, estimateValue } from "@/lib/clientPipeline";
import { parseCertPayload } from "@/lib/certBarcode";
import type { CardAttributes, CardAttributesConfidence, ValueEstimate } from "@/domain/types";

type FlowSource = "auto-id" | "cert" | "manual" | "search";

// Brief confirmation flash between capture and the (slower) recognize call —
// lets the user know the photo/code was actually captured and they can stop
// holding the phone steady, before "recognizing" kicks in for the
// Vision+Claude round trip.
const CAPTURED_FLASH_MS = 600;

type Step =
  | { kind: "capture" }
  | { kind: "captured"; label: string }
  | { kind: "recognizing" }
  | { kind: "recognize-failed"; mode: ScanMode; message: string }
  | {
      kind: "review";
      attributes: Partial<CardAttributes>;
      confidence?: CardAttributesConfidence;
      source: FlowSource;
      acquisition?: AcquisitionInput;
    }
  | { kind: "estimating"; attributes: CardAttributes; source: FlowSource; acquisition?: AcquisitionInput }
  | { kind: "estimate-failed"; attributes: CardAttributes; source: FlowSource; acquisition?: AcquisitionInput };

interface ScanAndReviewFlowProps {
  /** Collection saves require acquisition_price/acquisition_date on the same
   * form; Research does not (plan.md §6 "Shared Pipeline" — asking_price/
   * buy_signal are Research-only, acquisition fields are Collection-only).
   * Doubles here as the signal for "can this flow save with no estimate at
   * all" — Research's whole point is the estimate itself (POST /api/lookups
   * requires one server-side), so only the Collection path (this flag true)
   * ever skips straight to onReady(..., null, ...) while offline. */
  requireAcquisition: boolean;
  saveLabel: string;
  /** Called once the card is ready to persist. `estimate` is null when one
   * genuinely couldn't be obtained (offline, Collection path only) — the
   * backend accepts `estimate: null` on POST /api/cards. The caller owns
   * persistence (POST /api/cards vs POST /api/lookups) and whatever comes
   * after — this component's job stops at "identified (+ estimated, if
   * possible)". */
  onReady: (attrs: CardAttributes, estimate: ValueEstimate | null, acquisition?: AcquisitionInput) => Promise<void>;
  /** Bumped by the parent to reset back to the capture step (e.g. "Look up
   * another card"). Scan itself resets by navigating back to /scan. */
  resetKey?: number;
  /** Skip the camera entirely and start straight in the manual-entry form —
   * plan.md §3: ManualCorrectionForm is "used ... standalone for pure
   * manual entry with no scan at all." Wired from empty-state
   * "Enter Manually" buttons (Collection/Dashboard). */
  startInManualEntry?: boolean;
}

export function ScanAndReviewFlow({
  requireAcquisition,
  saveLabel,
  onReady,
  resetKey,
  startInManualEntry,
}: ScanAndReviewFlowProps) {
  const online = useOnlineStatus();
  const [mode, setMode] = useState<EntryMode>("auto-id");
  const [step, setStep] = useState<Step>(
    startInManualEntry ? { kind: "review", attributes: {}, source: "manual" } : { kind: "capture" },
  );
  const [saving, setSaving] = useState(false);

  // Reset to capture whenever the parent asks (e.g. "Look up another card").
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== undefined && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setStep({ kind: "capture" });
  }

  async function handleAutoIdCapture(imageBase64: string) {
    setStep({ kind: "captured", label: "Captured!" });
    await new Promise((resolve) => setTimeout(resolve, CAPTURED_FLASH_MS));
    setStep({ kind: "recognizing" });
    try {
      const result = await recognizeVision(imageBase64);
      setStep({ kind: "review", attributes: result.attributes, confidence: result.confidence, source: "auto-id" });
    } catch {
      setStep({
        kind: "recognize-failed",
        mode: "auto-id",
        message: "Couldn't get a clear read. Try better lighting, hold it steadier, or enter this one manually.",
      });
    }
  }

  async function handleCertDetected(rawValue: string) {
    const parsed = parseCertPayload(rawValue);
    if (!parsed) return; // not a recognizable payload — keep scanning
    setStep({ kind: "captured", label: "Code detected!" });
    await new Promise((resolve) => setTimeout(resolve, CAPTURED_FLASH_MS));
    setStep({ kind: "recognizing" });
    try {
      const attrs = await recognizeCert(parsed.certNumber, parsed.grader);
      setStep({ kind: "review", attributes: attrs, source: "cert" });
    } catch {
      // content.md's "Cert-lookup failure" copy is deliberately the same
      // wording for both "cert number not found" and "lookup service
      // unavailable" (e.g. the PSA adapter's current 501 stub) — one
      // message covers both per that section's own heading, not two.
      setStep({
        kind: "recognize-failed",
        mode: "cert",
        message:
          "That cert number didn't match anything. Double-check the number, or enter the card manually — you can add grade/grader by hand.",
      });
    }
  }

  async function handleReviewSubmit(attrs: CardAttributes, acquisition?: AcquisitionInput) {
    const source = step.kind === "review" ? step.source : "manual";

    // Offline, Collection path: /api/estimate is a Claude call and can never
    // succeed without a connection, so don't route through the estimating
    // step (and its inevitable failure) at all — save straight away with no
    // estimate. This is the fix for the offline manual-entry flow being
    // unreachable: previously every submit unconditionally went through
    // "estimating", so ScanPageClient's offline enqueue() branch could never
    // run. Research (requireAcquisition=false) always needs a real estimate
    // (it's the entire point of the page, and POST /api/lookups requires one
    // server-side), so it keeps going through the normal estimating step.
    if (!online && requireAcquisition) {
      setSaving(true);
      try {
        await onReady(attrs, null, acquisition);
      } finally {
        setSaving(false);
      }
      return;
    }

    setStep({ kind: "estimating", attributes: attrs, source, acquisition });
  }

  if (step.kind === "estimating") {
    return (
      <EstimatingStep
        step={step}
        requireAcquisition={requireAcquisition}
        onReady={onReady}
        onFail={() => setStep({ kind: "estimate-failed", attributes: step.attributes, source: step.source, acquisition: step.acquisition })}
        saving={saving}
        setSaving={setSaving}
      />
    );
  }

  if (step.kind === "estimate-failed") {
    return (
      <div className="rounded-xl border border-border bg-paper p-6 text-center">
        <p className="text-sm text-ink-70">Couldn&apos;t connect. Check your connection and try again.</p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="accent"
            onClick={() =>
              setStep({ kind: "estimating", attributes: step.attributes, source: step.source, acquisition: step.acquisition })
            }
          >
            Retry
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setStep({ kind: "review", attributes: step.attributes, source: step.source, acquisition: step.acquisition })
            }
          >
            Edit details
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "review") {
    return (
      <div className="flex flex-col gap-6">
        <IdentifiedCardSummary attributes={step.attributes} source={step.source} />
        <ManualCorrectionForm
          initial={step.attributes}
          initialAcquisition={step.acquisition}
          confidence={step.confidence}
          source={step.source}
          requireAcquisition={requireAcquisition}
          onSubmit={handleReviewSubmit}
          submitLabel={saveLabel}
        />
      </div>
    );
  }

  if (step.kind === "recognize-failed") {
    return (
      <div className="rounded-xl border border-border bg-paper p-6 text-center">
        <p className="text-sm text-ink-70">{step.message}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => setStep({ kind: "capture" })}>
            Try again
          </Button>
          <Button variant="accent" onClick={() => setStep({ kind: "review", attributes: {}, source: "manual" })}>
            Enter manually
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "search") {
    return (
      <div className="flex flex-col items-center gap-6">
        <ScanModeToggle mode={mode} onChange={setMode} />
        <CardSearchEntry
          onSelect={(attributes) => setStep({ kind: "review", attributes, source: "search" })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <ScanModeToggle mode={mode} onChange={setMode} />
      <CameraView
        mode={mode}
        disabled={!online}
        busy={step.kind === "recognizing" || step.kind === "captured"}
        onCapture={handleAutoIdCapture}
        onCertDetected={handleCertDetected}
      />
      {step.kind === "captured" && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-ink-70">
          <CheckIcon className="h-4 w-4 text-gold" aria-hidden="true" />
          {step.label}
        </p>
      )}
      {step.kind === "recognizing" && (
        <p role="status" className="text-sm font-medium text-ink-70">
          Analyzing card...
        </p>
      )}
      {!online && (
        <Button variant="secondary" onClick={() => setStep({ kind: "review", attributes: {}, source: "manual" })}>
          Enter manually instead
        </Button>
      )}
    </div>
  );
}

function EstimatingStep({
  step,
  onReady,
  onFail,
  setSaving,
}: {
  step: Extract<Step, { kind: "estimating" }>;
  requireAcquisition: boolean;
  onReady: ScanAndReviewFlowProps["onReady"];
  onFail: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setSaving(true);
    estimateValue(step.attributes)
      .then((estimate) => onReady(step.attributes, estimate, step.acquisition))
      .catch(onFail)
      .finally(() => setSaving(false));
    // Runs exactly once per mount of this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-paper p-8 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent" aria-hidden="true" />
      <p className="font-medium text-ink">Researching recent sales...</p>
      <p className="text-sm text-ink-70">This can take a few seconds.</p>
    </div>
  );
}
