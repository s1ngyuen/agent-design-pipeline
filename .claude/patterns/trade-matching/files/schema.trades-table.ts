// Generic peer-to-peer offer/request matching table. Merge into the
// project's src/db/schema.ts alongside the database pattern's tables.
// Rename `pending_trades` and its jsonb item shape to fit the domain
// (e.g. "swaps", "exchanges", "listings") — keep the `proposed` boolean.
import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './schema.auth-tables'; // delete if not using the auth pattern

export const pending_trades = pgTable('pending_trades', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  offering:   jsonb('offering').notNull(),   // TradeItem[] — what this user is giving up
  requesting: jsonb('requesting').notNull(), // TradeItem[] — what this user wants in return
  trade_with: text('trade_with'),            // partner display name/id — nullable
  // proposed = true: speculative, not yet confirmed with the other party.
  // proposed = false: confirmed/accepted. See README "Lessons Learned" —
  // every view that derives state from this table (missing-item lists,
  // summaries, exports) must apply the SAME inclusion rule for this flag.
  proposed:   boolean('proposed').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface TradeItem {
  itemId: string;
  count: number;
}
