// Example mutable-resource table demonstrating the optimistic-concurrency
// convention this pattern establishes. Rename `items` and its columns to the
// project's real domain table(s) — keep the `version` column and the
// (user_id, id) shape on any table that gets concurrent small updates.
//
// If the auth-google-oauth pattern is also selected, merge its
// schema.auth-tables.ts `users` table into this same schema.ts file so the
// `user_id` foreign key below resolves correctly.

import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './schema.auth-tables'; // delete this import if not using the auth pattern

export const items = pgTable('items', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:      text('title').notNull(),
  data:       jsonb('data').notNull().default({}),
  // Optimistic concurrency: every update checks `WHERE version = $expected`
  // and bumps it. Zero rows affected means a conflicting write already
  // landed — return 409 so the client refetches instead of silently losing
  // the write. See api/items/[id]/route.ts and hooks/useItems.example.ts.
  version:    integer('version').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
