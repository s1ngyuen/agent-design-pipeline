// Generic peer-to-peer matching: given what I have spare and what I want,
// matched against what a partner has spare and wants, find reciprocal trades.
// The matching/scoring logic itself (below) is intentionally simple —
// replace `scoreMatch` with the project's real prioritization rules
// (rarity, value, recency, whatever the domain needs). The shape around it
// (spares/wants sets, reciprocal matching) is the reusable part.

export interface OwnedItem {
  itemId: string;
  spareCount: number; // count > 1 elsewhere in the app; spareCount = count - 1
}

export interface Match {
  itemId: string;
  // true if I have a spare of this and the partner wants it
  iCanOffer: boolean;
  // true if the partner has a spare of this and I want it
  theyCanOffer: boolean;
}

export function findReciprocalMatches(
  mySpares: Set<string>,
  myWants: Set<string>,
  theirSpares: Set<string>,
  theirWants: Set<string>,
): Match[] {
  const candidateIds = new Set([...mySpares, ...theirSpares]);
  const matches: Match[] = [];

  for (const itemId of candidateIds) {
    const iCanOffer = mySpares.has(itemId) && theirWants.has(itemId);
    const theyCanOffer = theirSpares.has(itemId) && myWants.has(itemId);
    if (iCanOffer || theyCanOffer) {
      matches.push({ itemId, iCanOffer, theyCanOffer });
    }
  }

  return matches;
}

// Replace this with real domain-specific scoring (e.g. rarity tier, value,
// how long an item has been wanted) to prioritize which matches to surface
// first when there are more candidates than the UI should show at once.
export function scoreMatch(_match: Match): number {
  return 0;
}

/**
 * Lessons Learned (see README): when a "missing"/"still need" view is
 * computed from owned counts, it must also account for items already
 * covered by a pending trade — and the rule must be applied consistently
 * everywhere "missing" is computed (a summary view, an export action, a
 * generate-more-trades action), not just the one view being worked on.
 *
 * - Confirmed (proposed = false) incoming trades: exclude from "missing" —
 *   the item is effectively already covered.
 * - Speculative (proposed = true) incoming trades: still count as missing —
 *   the trade isn't real until confirmed.
 */
export function isCoveredByConfirmedTrade(
  itemId: string,
  incomingTrades: { requesting: { itemId: string }[]; proposed: boolean }[],
): boolean {
  return incomingTrades.some(
    t => !t.proposed && t.requesting.some(r => r.itemId === itemId),
  );
}
