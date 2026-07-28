// Client-side calls into the two recognition routes + /api/estimate.
// Mirrors lib/pipeline/identifyAndEstimate.ts's shape (plan.md §6) but from
// the browser side — Review/ManualCorrectionForm stay agnostic to which
// recognition flow produced the CardAttributes it's editing.

import { apiFetch, ApiError } from "@/lib/api";
import type { CardAttributes, CardAttributesConfidence, ValueEstimate, Grader } from "@/domain/types";

export interface VisionRecognizeResult {
  attributes: CardAttributes;
  confidence: CardAttributesConfidence;
  rawText: string;
}

export function recognizeVision(imageBase64: string): Promise<VisionRecognizeResult> {
  return apiFetch<VisionRecognizeResult>("/api/recognize/vision", {
    method: "POST",
    body: JSON.stringify({ image: imageBase64 }),
  });
}

export function recognizeCert(certNumber: string, grader: Extract<Grader, "PSA" | "BGS" | "SGC">): Promise<CardAttributes> {
  return apiFetch<CardAttributes>("/api/recognize/cert", {
    method: "POST",
    body: JSON.stringify({ certNumber, grader }),
  });
}

export function estimateValue(card: CardAttributes): Promise<ValueEstimate> {
  return apiFetch<ValueEstimate>("/api/estimate", {
    method: "POST",
    body: JSON.stringify({ card }),
  });
}

export { ApiError };
