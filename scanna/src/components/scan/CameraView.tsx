"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/Button";
import { CameraIcon } from "@/components/ui/icons";

export type ScanMode = "auto-id" | "cert";

interface CameraViewProps {
  mode: ScanMode;
  disabled?: boolean;
  /** Auto-ID: fires with a base64 JPEG (no data: prefix) when Capture is pressed. */
  onCapture: (base64Image: string) => void;
  /** Cert mode: fires as soon as a QR/barcode payload is decoded from the live feed. */
  onCertDetected: (rawValue: string) => void;
  busy?: boolean;
}

/** Shared camera viewfinder used by both ScanPage and ResearchPage (plan.md
 * §3 "Shared UI components" — identical capture UI, the divergence is what
 * happens after capture). Auto-ID mode captures a still frame on demand;
 * Cert mode continuously decodes QR codes from the live feed via jsQR.
 *
 * KNOWN v1.1 GAP (deliberately deferred, not fixed in this pass — flagged
 * per the UX/QA review): jsQR decodes QR codes only, not 1D barcodes
 * (Code128/EAN). Many current PSA/BGS/SGC slabs carry a 1D barcode *and* a
 * QR code on the label; only the QR actually scans today. ScanModeToggle's
 * "Cert Barcode" helper copy has been adjusted to say "Scan the QR code"
 * specifically so the UI doesn't imply 1D barcodes work when they don't —
 * that's the honest-expectations fix for this pass.
 *
 * Closing the gap for real means adding a 1D-capable decoder (e.g. a WASM
 * ZXing build such as `zxing-wasm`) alongside jsQR in the decode loop below
 * (try jsQR first since it's already synchronous/cheap, fall back to the
 * 1D decoder on a cadence that accounts for its async WASM init cost) — not
 * done here because it's a new binary dependency + async loading path that
 * needs real device testing to verify (this environment can't exercise a
 * live camera feed), not a same-shape swap. Scoped out of this fix pass
 * rather than shipped half-verified; worth prioritizing as its own ticket.
 */
export function CameraView({ mode, disabled, onCapture, onCertDetected, busy }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setPermissionError(
          "Couldn't access your camera. Check camera permissions for this site, or enter the card manually.",
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [disabled, mode]);

  // Cert mode: continuously decode QR codes from the live feed.
  useEffect(() => {
    if (mode !== "cert" || !ready || disabled) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let lastScan = 0;
    function tick(timestamp: number) {
      if (video && video.videoWidth && timestamp - lastScan > 300) {
        lastScan = timestamp;
        canvas!.width = video.videoWidth;
        canvas!.height = video.videoHeight;
        ctx!.drawImage(video, 0, 0, canvas!.width, canvas!.height);
        const imageData = ctx!.getImageData(0, 0, canvas!.width, canvas!.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          onCertDetected(code.data);
          return; // caller decides whether to keep scanning
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready, disabled]);

  const handleCapture = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1] ?? "";
    onCapture(base64);
  }, [onCapture]);

  if (disabled) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bone-100 p-6 text-center">
        <CameraIcon className="h-10 w-10 text-ink-50" />
        <p className="font-heading text-lg font-semibold text-ink">Recognition needs a connection</p>
        <p className="text-sm text-ink-70">
          Auto-ID and cert lookup both call out to services that only work online. You&apos;re offline right
          now, so scanning is paused — but manual entry works fine and syncs automatically once you&apos;re
          back.
        </p>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bone-100 p-6 text-center">
        <CameraIcon className="h-10 w-10 text-ink-50" />
        <p className="text-base text-ink-70">{permissionError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl border-2 border-border bg-ink">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-dashed border-gold/70" />
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {mode === "auto-id" && (
        <Button type="button" variant="accent" size="lg" onClick={handleCapture} loading={busy} disabled={!ready}>
          Capture
        </Button>
      )}
    </div>
  );
}
