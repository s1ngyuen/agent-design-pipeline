// Single source of truth for the database schema — auth tables (from the
// auth-google-oauth pattern) merged with Scanna's domain tables (cards,
// ebay_listings, lookups, sales) per plan.md §4.
//
// Run `npm run db:generate` after any edit here, review the generated SQL in
// migrations/, and commit it. Never hand-edit the live schema.

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────
// Auth tables (from auth-google-oauth pattern — @auth/drizzle-adapter shape)
// ─────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:            text('id').primaryKey().default(sql`gen_random_uuid()`),
  email:         text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  name:          text('name'),
  image:         text('image'),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  'account',
  {
    userId:            text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type:              text('type').notNull(),
    provider:          text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token:     text('refresh_token'),
    access_token:      text('access_token'),
    expires_at:        integer('expires_at'),
    token_type:        text('token_type'),
    scope:             text('scope'),
    id_token:          text('id_token'),
    session_state:     text('session_state'),
  },
  (account) => ({
    compositePk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId:       text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires:      timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token:      text('token').notNull(),
    expires:    timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Domain enums
// ─────────────────────────────────────────────────────────────────────────

export const sportEnum = pgEnum('sport', ['NFL', 'NBA', 'UFC', 'Soccer']);

export const conditionEnum = pgEnum('condition', ['Mint', 'Excellent', 'Good', 'Poor']);

export const graderEnum = pgEnum('grader', ['PSA', 'BGS', 'SGC', 'None']);

export const cardStatusEnum = pgEnum('card_status', ['in-stock', 'listed', 'sold']);

export const ebayListingStatusEnum = pgEnum('ebay_listing_status', [
  'draft',
  'active',
  'sold',
  'ended-unsold',
]);

export const buySignalEnum = pgEnum('buy_signal', ['good-buy', 'fair', 'walk-away']);

export const salePlatformEnum = pgEnum('sale_platform', ['eBay', 'other']);

// ─────────────────────────────────────────────────────────────────────────
// cards
// ─────────────────────────────────────────────────────────────────────────

export const cards = pgTable(
  'cards',
  {
    id:      uuid('id').primaryKey().defaultRandom(),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    sport:         sportEnum('sport').notNull(),
    league:        text('league'),
    player:        text('player').notNull(),
    team:          text('team').notNull(),
    year:          text('year').notNull(),
    manufacturer:  text('manufacturer').notNull(),
    product:       text('product').notNull(),
    card_number:   text('card_number').notNull(),
    parallel_name: text('parallel_name'),
    print_run:     integer('print_run'),
    is_auto:       boolean('is_auto').notNull().default(false),
    is_rookie:     boolean('is_rookie').notNull().default(false),
    condition:     conditionEnum('condition').notNull(),
    grade:         numeric('grade'),
    grader:        graderEnum('grader'),

    // Image URLs (e.g. Vercel Blob/S3) — not file bytes.
    photos: text('photos').array().notNull().default(sql`'{}'::text[]`),

    acquisition_price: numeric('acquisition_price').notNull().default('0'),
    acquisition_date:  date('acquisition_date').notNull(),
    status:            cardStatusEnum('status').notNull().default('in-stock'),

    estimated_value:       numeric('estimated_value'),
    value_estimate_detail: jsonb('value_estimate_detail'), // shape = ValueEstimate (src/domain/types.ts)

    notes: text('notes'),

    // Optimistic concurrency — cards receives frequent small edits (status
    // changes, re-estimates, bulk-intake corrections from multiple devices).
    version: integer('version').notNull().default(0),

    // Postgres-native search backing (per .claude/rules/technical-defaults.md
    // "Search"): player/team/set names are short proper nouns users often
    // type partial/misremembered fragments of (e.g. accented names), so
    // pg_trgm (fuzzy/substring) is used instead of tsvector full-text —
    // stored-generated so it never drifts from the source columns. Requires
    // `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (added by hand to the
    // generated migration — drizzle-kit doesn't manage extensions).
    search_text: text('search_text').generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`lower(coalesce(player, '') || ' ' || coalesce(team, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(product, '') || ' ' || coalesce(parallel_name, '') || ' ' || coalesce(card_number, '') || ' ' || coalesce(year, ''))`,
    ),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx:  index('cards_user_id_status_idx').on(t.user_id, t.status),
    userPlayerIdx:  index('cards_user_id_player_idx').on(t.user_id, t.player),
    userSportIdx:   index('cards_user_id_sport_idx').on(t.user_id, t.sport),
    searchTrgmIdx:  index('cards_search_text_trgm_idx').using('gin', sql`${t.search_text} gin_trgm_ops`),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// checklist_cards — real per-product checklist reference data (scraped from
// manufacturer/hobby-media checklist spreadsheets, e.g. Beckett's downloadable
// .xlsx checklists), NOT user inventory. Used to cross-check/enrich a
// scanned card's extracted attributes against a known-real card, and to back
// autocomplete in ManualCorrectionForm — replacing the never-realized TCDB
// integration (lib/tcdb/client.ts never had a confirmed real API to call).
// One row per printed card (base, insert, autograph, relic, parallel, etc.)
// — a single product/year can contribute hundreds to low-thousands of rows.
// ─────────────────────────────────────────────────────────────────────────

export const checklistCards = pgTable(
  'checklist_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    sport:        sportEnum('sport').notNull(),
    year:         text('year').notNull(),
    manufacturer: text('manufacturer').notNull(),
    product:      text('product').notNull(), // e.g. "2025 Topps Chrome Football"
    // The named subset/insert/parallel-tier a card belongs to within the
    // product, e.g. "Base", "Base - Rookies", "Chrome Autographs" — distinct
    // from `parallel_name` (a specific colour/refractor variant), which
    // these scraped checklists generally don't itemize card-by-card.
    subset: text('subset').notNull(),

    card_number:   text('card_number'),
    player:        text('player').notNull(),
    team:          text('team'),
    parallel_name: text('parallel_name'),
    print_run:     integer('print_run'),
    is_auto:       boolean('is_auto').notNull().default(false),
    is_rookie:     boolean('is_rookie').notNull().default(false),

    // Where this row was scraped from — provenance, not shown to end users.
    source_url: text('source_url'),

    // Same fuzzy-search convention as cards.search_text (pg_trgm, not
    // tsvector — see cards table above for why).
    search_text: text('search_text').generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`lower(coalesce(player, '') || ' ' || coalesce(team, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(product, '') || ' ' || coalesce(subset, '') || ' ' || coalesce(card_number, '') || ' ' || coalesce(year, ''))`,
    ),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productSubsetIdx: index('checklist_cards_product_subset_idx').on(t.product, t.subset),
    playerIdx:        index('checklist_cards_player_idx').on(t.player),
    searchTrgmIdx:    index('checklist_cards_search_text_trgm_idx').using('gin', sql`${t.search_text} gin_trgm_ops`),
    // Lets a re-import of the same source file skip rows it's already
    // inserted (ON CONFLICT DO NOTHING) instead of accumulating duplicates.
    uniqueCardIdx: uniqueIndex('checklist_cards_unique_idx').on(
      t.product,
      t.subset,
      t.card_number,
      t.player,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// ebay_listings
// ─────────────────────────────────────────────────────────────────────────

export const ebayListings = pgTable(
  'ebay_listings',
  {
    id:      uuid('id').primaryKey().defaultRandom(),
    card_id: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),

    ebay_listing_id: text('ebay_listing_id'), // set only once published
    // Not in the brief's schema table verbatim — required to call
    // publishOffer() later, so tracked here per plan.md §4.
    ebay_offer_id: text('ebay_offer_id'), // set on draft creation (createOffer)
    // Two more fields the eBay Sell API requires that plan.md §4 didn't
    // enumerate verbatim (same "added here, flagged" treatment as
    // ebay_offer_id above — needs sign-off like that field did):
    //  - sku: the Inventory API's item identifier (createOrReplaceInventoryItem
    //    is keyed by SKU, distinct from both ebay_offer_id and
    //    ebay_listing_id); generated at draft-creation time.
    //  - category_id: the eBay category the draft was created against
    //    (Taxonomy API), needed to re-fetch aspects / edit the draft later.
    sku:         text('sku'),
    category_id: text('category_id'),

    title:          text('title').notNull(),
    start_price:    numeric('start_price'),
    buy_now_price:  numeric('buy_now_price'),
    status:         ebayListingStatusEnum('status').notNull().default('draft'),
    listed_date:    date('listed_date'),
    ended_date:     date('ended_date'),
    views:          integer('views'),
    watchers:       integer('watchers'),
    last_synced:    timestamp('last_synced', { withTimezone: true }),

    // Optimistic concurrency — explicitly required by the brief for
    // status/views/watchers, which get updated by /api/ebay/sync.
    version: integer('version').notNull().default(0),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cardIdx: index('ebay_listings_card_id_idx').on(t.card_id),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// ebay_accounts — NOT in plan.md §4 (a gap in the plan, flagged here rather
// than invented silently). The Inventory/Offer APIs require a per-seller
// user access token obtained via eBay's 3-legged OAuth (authorization-code
// grant) — unlike Taxonomy API reads, they can't run on a client-credentials
// app token. plan.md §6 "eBay Integration" says lib/ebay/auth.ts handles
// "OAuth token exchange/refresh, stored per-user" but never defines where
// that's stored. This table is the minimal fill-in: one row per app user
// who has connected their eBay seller account. Needs explicit sign-off, same
// as the ebay_offer_id/sku/category_id additions above.
// ─────────────────────────────────────────────────────────────────────────

export const ebayAccounts = pgTable('ebay_accounts', {
  id:      uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),

  access_token:            text('access_token').notNull(),
  refresh_token:           text('refresh_token').notNull(),
  access_token_expires_at: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),

  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// ebay_oauth_states — server-side record of an in-flight eBay OAuth
// authorization-code flow. Fixes a HIGH-severity gap: `state` was
// previously a deterministic HMAC(AUTH_SECRET, userId) with no expiry, no
// nonce, and no single-use enforcement — a leaked `state` value could be
// replayed indefinitely to link an attacker's eBay authorization code into
// another user's account. Now `/oauth/start` mints a random nonce, stores
// it here (short expiry, single-use via `used_at`), and `/oauth/callback`
// is the only thing that ever trusts the associated user_id — never derived
// from a value that round-trips through the browser/URL alone.
// ─────────────────────────────────────────────────────────────────────────

export const ebayOauthStates = pgTable('ebay_oauth_states', {
  id:         uuid('id').primaryKey().defaultRandom(),
  // .unique() already gives this column a supporting index — no need for a
  // separate explicit index alongside it.
  nonce:      text('nonce').notNull().unique(),
  user_id:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Set once the callback has consumed this nonce — enforces single-use.
  used_at:    timestamp('used_at', { withTimezone: true }),
});

// ─────────────────────────────────────────────────────────────────────────
// lookups (Research Mode)
// ─────────────────────────────────────────────────────────────────────────
// Deliberate deviation from the pattern's "every mutable table gets a
// version column" convention: lookups is effectively write-once-then-
// rarely-edited (its only post-create mutation is asking_price, single-actor
// in practice). Flagged in plan.md §8 open question #4 for sign-off.

export const lookups = pgTable(
  'lookups',
  {
    id:      uuid('id').primaryKey().defaultRandom(),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    sport:         sportEnum('sport').notNull(),
    league:        text('league'),
    player:        text('player').notNull(),
    team:          text('team').notNull(),
    year:          text('year').notNull(),
    manufacturer:  text('manufacturer').notNull(),
    product:       text('product').notNull(),
    card_number:   text('card_number').notNull(),
    parallel_name: text('parallel_name'),
    print_run:     integer('print_run'),
    is_auto:       boolean('is_auto').notNull().default(false),
    is_rookie:     boolean('is_rookie').notNull().default(false),
    condition:     conditionEnum('condition').notNull(),
    grade:         numeric('grade'),
    grader:        graderEnum('grader'),

    estimated_value:       numeric('estimated_value'),
    value_estimate_detail: jsonb('value_estimate_detail'),

    looked_up_at: timestamp('looked_up_at', { withTimezone: true }).notNull().defaultNow(),

    asking_price: numeric('asking_price'),
    buy_signal:   buySignalEnum('buy_signal'),

    converted_card_id: uuid('converted_card_id').references(() => cards.id),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userLookedUpAtIdx: index('lookups_user_id_looked_up_at_idx').on(t.user_id, t.looked_up_at),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// sales
// ─────────────────────────────────────────────────────────────────────────
// Same deviation note as lookups — sale records are edited rarely, long
// after creation, so no version column (plan.md §4/§8 open question #4).

export const sales = pgTable(
  'sales',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    card_id:          uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    ebay_listing_id:  uuid('ebay_listing_id').references(() => ebayListings.id),

    sale_price:     numeric('sale_price').notNull(),
    sale_date:      date('sale_date').notNull(),
    platform:       salePlatformEnum('platform').notNull(),
    fees:           numeric('fees'),
    shipping_cost:  numeric('shipping_cost'),
    // Derived/stored at write time: sale_price - fees - shipping_cost -
    // card.acquisition_price. Not a Postgres generated column since it
    // depends on a joined table's value (plan.md §4).
    net_profit:     numeric('net_profit').notNull(),
    buyer_notes:    text('buyer_notes'),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cardIdx: index('sales_card_id_idx').on(t.card_id),
  }),
);
