// Shared orchestration for Collection (Scan) and Research — both follow
// identify -> estimate -> [persist], and the first two steps are identical
// code, per plan.md §6 "Shared Pipeline". Calls the recognition logic
// directly (server-side function calls, not an HTTP round-trip to our own
// API routes) then the Claude estimate. Never persists anything — callers
// (POST /api/cards vs POST /api/lookups) are what diverge.

import type { CardAttributes, CardAttributesConfidence, ValueEstimate, Grader } from '@/domain/types';
import { annotateCardImage } from '@/lib/recognition/visionClient';
import { parseVisionResult } from '@/lib/recognition/parseVisionResult';
import { getCertLookupAdapter } from '@/lib/recognition/psaCertLookup';
import { estimateCardValue } from '@/lib/estimate/claudeEstimate';

export type IdentifyInput =
  | { mode: 'vision'; imageBase64: string }
  | { mode: 'cert'; certNumber: string; grader: Grader };

export interface IdentifyAndEstimateResult {
  card: CardAttributes;
  /** Per-field confidence — present for the vision flow, absent (authoritative) for cert lookups. */
  confidence: CardAttributesConfidence | null;
  estimate: ValueEstimate;
}

export async function identifyAndEstimate(input: IdentifyInput): Promise<IdentifyAndEstimateResult> {
  let card: CardAttributes;
  let confidence: CardAttributesConfidence | null;

  if (input.mode === 'vision') {
    const raw = await annotateCardImage(input.imageBase64);
    const parsed = parseVisionResult(raw);
    card = parsed.attributes;
    confidence = parsed.confidence;
  } else {
    const adapter = getCertLookupAdapter();
    const certResult = await adapter.lookupCert(input.certNumber, input.grader);
    const { cert_number: _certNumber, ...attributes } = certResult;
    void _certNumber;
    card = attributes;
    confidence = null; // authoritative PSA record — no per-field confidence needed
  }

  const estimate = await estimateCardValue(card);

  return { card, confidence, estimate };
}
