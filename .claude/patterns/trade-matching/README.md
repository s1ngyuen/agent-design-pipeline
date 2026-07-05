# Pattern: Trade/Swap Matching

## What this provides

A peer-to-peer offer/request table (`pending_trades`) with a speculative-vs-confirmed (`proposed`) flag, ownership-guarded CRUD routes, and a generic reciprocal-matching function. For any app where users trade, swap, or exchange items with each other.

## When to use it

The brief describes a flow where two users' "have"/"want" lists get matched against each other — trading cards, swapping items, exchanging listings, etc. Pairs with the database-neon-drizzle pattern (needs the `users` table from the auth pattern, or an equivalent user reference).

## Setup steps

1. Merge `files/schema.trades-table.ts` into the project's `src/db/schema.ts`.
2. Copy `files/api/trades/route.ts` and `files/api/trades/[id]/route.ts` into `src/app/api/trades/`.
3. Copy `files/lib/matching.example.ts` and replace `scoreMatch` with the project's real prioritization rules — the reciprocal-matching shape (`findReciprocalMatches`) is the reusable part, the scoring is domain-specific.
4. Rename `pending_trades`/`TradeItem` to the domain's real vocabulary (swaps, exchanges, listings) — keep the `proposed` boolean and the ownership guard (`WHERE id = $id AND user_id = $userId`) on every route.

## Lessons Learned

- **A partial-update handler that only forwards a fixed subset of fields will silently drop any field it doesn't explicitly pass through.** This shipped a real bug: an update handler that only forwarded `offering`/`requesting` reset every trade's `proposed` flag back to its default on every single edit, because the handler wasn't updated when `proposed` was added to the schema later. `files/api/trades/[id]/route.ts` forwards every optional field explicitly and includes an inline warning comment — when adding a new column to this table, grep for every place that builds a partial update object and make sure the new field is threaded through all of them.
- **When a table has a speculative-vs-confirmed distinction (`proposed`), every view that derives state from it must apply the same inclusion rule — consistently.** This shipped as *two separate bugs*, fixed in two separate commits, because a "missing/still need" computation was fixed in one view (the main collection screen) and the same logic was needed — and initially missed — in a second view (a trade-generation screen) and a third (a clipboard export action). `files/lib/matching.example.ts`'s `isCoveredByConfirmedTrade` centralizes the rule in one function specifically so it can be reused everywhere instead of reimplemented per view. When you add a new "confirmed excludes it, speculative doesn't" consumer, call this function — don't reimplement the check inline.
