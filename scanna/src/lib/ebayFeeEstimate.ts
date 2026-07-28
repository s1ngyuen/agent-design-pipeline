// Rough eBay final-value-fee projection for the "Before you list" preview
// (content.md, Card Detail). Not exact — eBay's real fee schedule varies by
// category and store subscription — explicitly framed in the UI as "a
// projection based on the current estimate, not a guarantee of sale price."
const TYPICAL_FVF_RATE = 0.1325; // ~13.25%, eBay's typical trading-cards-category rate
const TYPICAL_FVF_FIXED = 0.3;

export function projectedNetProceeds(estimatedMid: number): number {
  const fee = estimatedMid * TYPICAL_FVF_RATE + TYPICAL_FVF_FIXED;
  return Math.max(0, estimatedMid - fee);
}
