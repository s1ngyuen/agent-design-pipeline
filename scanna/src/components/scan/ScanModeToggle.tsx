"use client";

import type { ScanMode } from "./CameraView";
import { cn } from "@/lib/cn";

/** Scan flow's top-level entry mode — a superset of CameraView's own
 * ScanMode (auto-id/cert, which are specifically about the camera): "search"
 * bypasses the camera entirely in favor of looking the card up in our
 * checklist database (see CardSearchEntry). */
export type EntryMode = ScanMode | "search";

const HELPER_COPY: Record<EntryMode, string> = {
  "auto-id":
    "Center the card in frame, good light helps. We'll read the front and confirm with you before anything is saved.",
  // CameraView's decoder (jsQR) only reads QR codes, not 1D barcodes
  // (Code128/EAN) — many PSA/BGS/SGC slabs carry both, but only the QR
  // actually scans today. Copy says "QR code" specifically rather than the
  // more general "barcode" so expectations match what the camera can
  // actually do; see CameraView.tsx for the known-gap note on 1D support.
  cert: "Scan the QR code on the slab label. Graded cards get an exact match — no guessing.",
  search: "Already know the card? Search our checklist database and pick the exact match instead of scanning.",
};

const LABELS: Record<EntryMode, string> = {
  "auto-id": "Auto-ID",
  cert: "Cert Barcode",
  search: "Search",
};

export function ScanModeToggle({
  mode,
  onChange,
}: {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div role="tablist" aria-label="Scan mode" className="inline-flex rounded-lg border border-border bg-paper p-1">
        {(["auto-id", "cert", "search"] as EntryMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => onChange(m)}
            className={cn(
              "min-h-[44px] rounded-md px-4 text-sm font-medium transition-colors",
              mode === m ? "bg-ink text-bone" : "text-ink-70 hover:bg-bone-100",
            )}
          >
            {LABELS[m]}
          </button>
        ))}
      </div>
      <p className="max-w-sm text-center text-sm text-ink-70">{HELPER_COPY[mode]}</p>
    </div>
  );
}
