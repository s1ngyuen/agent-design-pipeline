"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/** Rapid-fire bulk intake — the hard requirement from brief.md: after
 * saving a card, this returns straight to the camera, never to an
 * intermediate menu. */
export function ScanNextButton({ firstInSession }: { firstInSession?: boolean }) {
  const router = useRouter();
  const [showHelper] = useState(!!firstInSession);

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="accent"
        size="lg"
        className="w-full"
        onClick={() => router.push("/scan")}
      >
        Scan Next →
      </Button>
      {showHelper && <p className="text-xs text-ink-50">Straight back to the camera — keep going through the box.</p>}
    </div>
  );
}
