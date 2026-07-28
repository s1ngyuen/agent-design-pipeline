// Good-buy / fair / walk-away threshold logic for Research Mode, per
// plan.md §6 "Shared Pipeline" and brief.md's Key User Flows. Ported
// concept from card-ladder's `bidCeiling.ts` (that project's own plan.md
// §6 `computeThresholds`) — card-ladder's actual code doesn't exist yet
// (that project only has brief.md/plan.md, no built lib/), so this is a
// fresh implementation of the same described logic, not a copy:
//
//   - below the estimate's range.low  -> "good-buy"
//   - within [range.low, range.high]  -> "fair"
//   - above the estimate's range.high -> "walk-away"
//
// card-ladder's plan defaults to "walk-away starts exactly above the
// estimate's high end, no added margin" (flagged there as an open question
// re: whether a cushion is wanted) — Scanna follows that same default here
// for consistency, since the brief doesn't specify otherwise.
//
// Framing note (carried over from card-ladder, applies to Scanna's UI too):
// non-financial-signal language — no red/green gain/loss framing, no
// "buy"/"sell" as literal financial actions. Pass this constraint to
// designer/frontend-developer.

import type { BuySignal, ValueEstimateRange } from '@/domain/types';

export function computeBuySignal(range: ValueEstimateRange, askingPrice: number): BuySignal {
  if (askingPrice < range.low) return 'good-buy';
  if (askingPrice > range.high) return 'walk-away';
  return 'fair';
}
