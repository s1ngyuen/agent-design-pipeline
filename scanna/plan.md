> Source brief dated: 2026-07-27

# Plan: Scanna

## 0. Summary of Approach

Scanna is a multi-user, full-stack PWA: Next.js (App Router) on Vercel, Neon Postgres via Drizzle, Google OAuth via NextAuth v5. Two selected feature patterns (`database-neon-drizzle`, `auth-google-oauth`) cover the persistence and auth layers almost entirely — this plan scaffolds from them rather than inventing an auth/DB layer from scratch. Everything domain-specific (recognition pipeline, value-estimation contract, eBay draft/publish gate, Research vs. Collection divergence, offline PWA behaviour) is new and is the bulk of this document.

---

## 1. Tech Stack Decision

The brief already pins the stack; this section justifies it rather than re-deciding it.

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router), mobile-first, PWA | Needs auth, a database, server-side API routes for third-party secrets (Vision/Claude/eBay/PSA keys must never reach the client), and installability — Next.js on Vercel is the only stack in our catalog that covers all four without bolting on a separate backend. |
| Backend | Next.js API routes (Route Handlers) | Co-located with the frontend, no separate service to deploy/operate for a single-owner business tool; every external API call (Vision, Claude, eBay, TCDB, PSA) needs a server-side secret boundary anyway. |
| Database | Neon Postgres + Drizzle ORM | Brief specifies it; matches `database-neon-drizzle` pattern exactly — serverless Postgres with a reviewable migration history, needed for durable multi-user inventory/sales data (not a static dataset). |
| Auth | NextAuth v5 + Google OAuth | Brief specifies it; matches `auth-google-oauth` pattern — JWT sessions (not database sessions) so authenticated requests don't cost a DB read on every call, which matters here since Scan/Review/Research are called repeatedly in a single shop visit. |
| Hosting | Vercel | Brief specifies it; native Next.js support, trivial preview-per-PR, works with the CI workflow shape in `.claude/rules/ci-cd.md`. |
| PWA layer | `next-pwa` (Workbox under the hood) + a custom IndexedDB outbox | Workbox handles app-shell precaching and the TCDB-checklist cache-first strategy; a custom outbox (not the browser Background Sync API) handles queued writes, because Background Sync has no Safari/iOS support and this app's primary device is a phone at a card show — see §PWA below. |

---

## 1a. Template Selection

Both patterns named in the brief's Feature Patterns section apply. Build starts from the base scaffold, not a bespoke tree:

1. `npx create-next-app@latest scanna --typescript --tailwind --app --eslint`
2. Copy in `auth-google-oauth/files/*`: `middleware.ts`, `auth.ts`, `types/next-auth.d.ts`, `api/auth/[...nextauth]/route.ts`, and the `schema.auth-tables.ts` fragment.
3. Copy in `database-neon-drizzle/files/*`: `drizzle.config.ts`, `db/index.ts`, and use `db/schema.example.ts` + `api/items/route.ts` + `api/items/[id]/route.ts` as the shape to follow for every domain table (rename `items` → `cards`, `ebay_listings`, etc. — see §4).
4. Do **not** copy `search-batch-add`'s files wholesale (brief explicitly says it doesn't fit the one-card-at-a-time flow) — but do reuse its `searchIndex.example.ts` normalize/debounce technique for the TCDB-backed manual-entry dropdowns (accent-normalized, debounced ~150ms, prefix matching for parallel/set sub-groups). This lives in `src/lib/tcdbSearchIndex.ts`, a purpose-built adaptation, not a copied file.

**Merge points:**
- `src/db/schema.ts` = `schema.auth-tables.ts` (`users`, `accounts`, `sessions`, `verificationTokens`) **+** the domain tables in §4 (`cards`, `ebay_listings`, `lookups`, `sales`), in one file, per `schema.example.ts`'s own instruction. Domain tables' `user_id` FKs reference `users.id`.
- `auth.ts` is used as-is (JWT strategy, Google provider) — no changes needed beyond env vars.
- `db/index.ts` is used as-is.

**Env vars to fold into `.env.example`:**
From `auth-google-oauth`: `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
From `database-neon-drizzle`: `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations only).
New for this project (no pattern covers these): `GOOGLE_VISION_API_KEY` (or service-account JSON path), `ANTHROPIC_API_KEY`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, `EBAY_ENVIRONMENT` (`sandbox`/`production`), `TCDB_API_KEY` (if required — confirm during backend build), `PSA_API_KEY` (placeholder, pending Open Questions item on PSA access).

**Dependencies to fold into `package.json`:**
From patterns: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` (dev), `dotenv` (dev), `next-auth@^5.0.0-beta`, `@auth/drizzle-adapter`.
New: `@anthropic-ai/sdk`, `@google-cloud/vision` (or plain `fetch` against the REST endpoint — prefer REST to avoid pulling in the full gRPC client for a single-region serverless function), `next-pwa`, `zod` (request/response validation for all API routes, especially the Claude structured-output contract in §API below), `papaparse` or a hand-rolled CSV writer for export.

---

## 2. File & Folder Structure

Diff against the template (create-next-app + the two patterns copied in per §1a):

```
scanna/
├── brief.md
├── plan.md
├── content.md                          (from content-writer)
├── deployment.md                       (from deployment agent)
├── .github/workflows/ci.yml            (from deployment agent — full-stack CI shape)
├── .env.example
├── drizzle.config.ts                   [from pattern]
├── next.config.js                      (extended with next-pwa wrapper)
├── public/
│   ├── manifest.json                   (PWA manifest — name, icons, display: standalone, theme colours pending designer step)
│   ├── icons/                          (192/512 px + maskable variants)
│   └── offline.html                    (Workbox offline fallback for full-page navigations)
├── references/
└── src/
    ├── middleware.ts                   [from pattern] — extend matcher to protect all app routes except NextAuth's own callback routes
    ├── auth.ts                         [from pattern, unchanged]
    ├── types/next-auth.d.ts            [from pattern, unchanged]
    ├── db/
    │   ├── index.ts                    [from pattern, unchanged]
    │   ├── schema.ts                   [merged: auth tables + domain tables, see §4]
    │   └── seed.ts                     (parses the user's 23-row spreadsheet → cards + ebay_listings for `Listed: Yes` rows)
    ├── migrations/                     (drizzle-kit generate output, committed)
    ├── app/
    │   ├── layout.tsx                  (root layout — manifest link, viewport meta, AppShell wrapper)
    │   ├── page.tsx                    (sign-in / landing — Swappa-inspired login UX structurally, see designer step)
    │   ├── (app)/                      (route group — everything behind auth middleware)
    │   │   ├── layout.tsx              (AppShell: BottomNav + OfflineBanner)
    │   │   ├── scan/page.tsx
    │   │   ├── research/page.tsx
    │   │   ├── collection/page.tsx
    │   │   ├── collection/[id]/page.tsx        (Card Detail)
    │   │   ├── listings/page.tsx               (eBay Listings)
    │   │   └── dashboard/page.tsx
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts     [from pattern]
    │       ├── recognize/
    │       │   ├── vision/route.ts             (Vision API flow — see §Recognition)
    │       │   └── cert/route.ts               (PSA cert lookup flow — see §Recognition)
    │       ├── estimate/route.ts                (Claude value-estimation — shared by Collection + Research)
    │       ├── cards/
    │       │   ├── route.ts                     (GET list, POST create)
    │       │   ├── [id]/route.ts                 (GET, PATCH w/ expectedVersion, DELETE)
    │       │   ├── [id]/estimate/route.ts         (re-run estimate on an existing card)
    │       │   └── export/route.ts                (CSV export, filterable)
    │       ├── lookups/
    │       │   ├── route.ts                      (GET recent, POST create — Research Mode)
    │       │   ├── [id]/route.ts                  (PATCH asking_price → recompute buy_signal)
    │       │   └── [id]/convert/route.ts          (POST → creates a Card, sets converted_card_id)
    │       ├── ebay/
    │       │   ├── listings/route.ts              (GET tracked listings, POST create DRAFT — never publishes)
    │       │   ├── listings/[id]/route.ts          (PATCH draft fields w/ expectedVersion)
    │       │   ├── listings/[id]/publish/route.ts  (POST — the ONLY route that calls publishOffer)
    │       │   ├── sync/route.ts                   (POST — polls status/views/watchers for active listings)
    │       │   └── aspects/route.ts                (GET — proxies Taxonomy API getItemAspectsForCategory)
    │       ├── sales/
    │       │   ├── route.ts                       (GET history, POST mark-sold)
    │       │   └── [id]/route.ts                   (PATCH edit)
    │       ├── dashboard/stats/route.ts
    │       └── tcdb/checklist/route.ts             (GET — proxies + server-side caches TCDB checklist by sport)
    ├── lib/
    │   ├── pipeline/
    │   │   └── identifyAndEstimate.ts    (shared orchestration — see §Shared Pipeline)
    │   ├── recognition/
    │   │   ├── visionClient.ts           (Google Vision REST wrapper: object localization + text detection)
    │   │   └── psaCertLookup.ts           (adapter interface + stub impl — pending Open Question)
    │   ├── estimate/
    │   │   ├── claudeEstimate.ts           (Anthropic call w/ web_search_20260209 + web_fetch_20260209 tools, agentic tool-use loop, zod-validated structured final answer — see §Claude Contract)
    │   │   └── buySignal.ts                (good-buy/fair/walk-away threshold logic, ported from card-ladder's `bidCeiling.ts`)
    │   ├── ebay/
    │   │   ├── auth.ts                     (eBay OAuth token exchange/refresh, stored per-user)
    │   │   ├── inventoryApi.ts              (createOrReplaceInventoryItem)
    │   │   ├── offerApi.ts                  (createOffer, publishOffer — kept in separate exported functions, never composed into one)
    │   │   └── taxonomyApi.ts               (getItemAspectsForCategory)
    │   ├── tcdb/
    │   │   ├── client.ts                    (TCDB API wrapper, NFL/NBA only)
    │   │   └── searchIndex.ts               (normalize/debounce/prefix-match technique borrowed from search-batch-add)
    │   ├── csv.ts                          (inventory export)
    │   └── offlineQueue.ts                 (IndexedDB outbox — see §PWA)
    ├── hooks/
    │   ├── useCards.ts                    (SWR/fetch + optimistic PATCH w/ version, modelled on pattern's `useItems.example.ts`)
    │   ├── useLookups.ts
    │   ├── useEbayListings.ts
    │   ├── useOnlineStatus.ts
    │   └── useOfflineQueue.ts
    ├── components/
    │   ├── layout/                        (AppShell, BottomNav, OfflineBanner, Header)
    │   ├── scan/                           (CameraView, ScanModeToggle, CaptureButton, RecognitionOverlay)
    │   ├── review/                        (IdentifiedCardSummary, FieldConfidenceBadge, ManualCorrectionForm, ScanNextButton)
    │   ├── research/                      (AskingPriceInput, BuySignalBadge, RecentlyLookedUpList, AddToInventoryButton)
    │   ├── collection/                    (CardTable/CardGrid, FilterBar, ExportButton, BulkActionsBar)
    │   ├── card-detail/                   (ValueEstimateBreakdown, ListingHistoryTable, MarkSoldForm, CreateDraftListingButton, PublishListingButton, EditCardForm)
    │   ├── listings/                      (ListingsTable, ListingStatusBadge, SyncButton)
    │   ├── dashboard/                     (StatCard, SalesHistoryTable)
    │   └── ui/                            (shadcn primitives: Button, Input, Select, Combobox, Badge, Dialog, Table, Tabs, Card, Toast)
    └── domain/
        └── types.ts                       (Card, EbayListing, Lookup, Sale, ValueEstimate TS types — mirrors §4/§Claude Contract, used for zod schemas)
```

---

## 3. Component Hierarchy

### Layout components (shared)
- **AppShell** — wraps all authenticated routes; renders BottomNav + OfflineBanner + page content. Props: none (session read via `auth()` server-side in the layout).
- **BottomNav** — Scan / Research / Collection / Listings / Dashboard, mobile-first, large touch targets (one-handed use case echoed from card-ladder). Props: `activePath`.
- **OfflineBanner** — shows when `useOnlineStatus` is false, and shows a pending-queue count from `useOfflineQueue`. Explains that recognition/valuation are unavailable offline (see §PWA) but manual entry still works.
- **Header** — page title + contextual primary action (e.g. "Scan Next" on Review).

### Page-level components
- **ScanPage** (`/scan`) — CameraView (getUserMedia), ScanModeToggle (Auto-ID vs. Cert Barcode), CaptureButton. On capture, posts to `/api/recognize/vision` or `/api/recognize/cert` depending on mode, then routes to Review with the result in transient state. Disabled/greyed with explanatory copy when offline.
- **ReviewPage** (`/scan/review`, client-routed state not a distinct URL necessarily — confirm with frontend-developer) — IdentifiedCardSummary + FieldConfidenceBadge per field, ManualCorrectionForm (TCDB dropdowns for NFL/NBA, free-text for Soccer, UFC hidden/deferred) pre-filled from recognition result, Save button → `POST /api/cards`, then **ScanNextButton** returns straight to `/scan` (rapid-fire bulk intake — no intermediate menu).
- **ResearchPage** (`/research`) — same CameraView/Review components as Scan (shared, not duplicated — see composition note below) plus AskingPriceInput and BuySignalBadge once an estimate exists, RecentlyLookedUpList (last N lookups), AddToInventoryButton per list item → `POST /api/lookups/[id]/convert`.
- **CollectionPage** (`/collection`) — CardTable/CardGrid, FilterBar (sport/status/search — debounced text search), ExportButton (CSV), BulkActionsBar (delete/mark-sold entry points). Data: `useCards()`.
- **CardDetailPage** (`/collection/[id]`) — ValueEstimateBreakdown (renders the Claude contract's range/confidence/reference_breakdown/divergence_flag/caveats), ListingHistoryTable (all `eBay Listing` rows for this card), MarkSoldForm, EditCardForm, **CreateDraftListingButton** and **PublishListingButton** rendered as two separate, visually distinct controls — Publish only enabled/visible once a draft exists and unpublished, with a confirmation dialog ("This makes the listing live on eBay") since it's the one irreversible action in the flow.
- **EBayListingsPage** (`/listings`) — ListingsTable (from DB, not live eBay calls per page load), SyncButton (`POST /api/ebay/sync`) for on-demand refresh in addition to a periodic backend sync (see §6 Build Order / §Open Questions on sync cadence).
- **DashboardPage** (`/dashboard`) — StatCard × N (total inventory value, profit/loss, item counts by status), SalesHistoryTable. Data: `GET /api/dashboard/stats`, computed server-side.

### Shared UI components
- **CameraView** — used by both ScanPage and ResearchPage (identical capture UI; the divergence is what happens after capture, not the capture UI itself).
- **FieldConfidenceBadge** — per-field confidence indicator, used in Review (both Scan and Research paths).
- **ManualCorrectionForm** — sport-specific dropdowns (TCDB-backed Combobox for NFL/NBA using `tcdb/searchIndex.ts`, free-text for Soccer), used in Review (both paths) and standalone for pure manual entry with no scan at all.
- **ValueEstimateBreakdown** — renders the shared `ValueEstimate` shape; used on Card Detail (Collection) and inline on Research's result card. Same component, different container.
- **BuySignalBadge** / **ThresholdMeter** — good-buy/fair/walk-away, Research-only (ported concept from card-ladder). Non-financial-signal framing per that project's lesson (no red/green gain-loss language) — pass this constraint to `designer`.
- **Button, Input, Select, Combobox, Badge, Dialog, Table, Tabs, Card, Toast** (shadcn/ui).

---

## 4. Data Models

All tables live in `src/db/schema.ts`, generated via `drizzle-kit generate` and committed under `migrations/`. `users`/`accounts`/`sessions`/`verificationTokens` come from the auth pattern unchanged (see §1a). Enums are Postgres enums via `pgEnum`.

### `cards`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default random |
| user_id | text | FK → users.id, not null, cascade delete |
| sport | enum(NFL, NBA, UFC, Soccer) | not null |
| league | text | nullable |
| player | text | not null |
| team | text | not null |
| year | text | not null |
| manufacturer | text | not null |
| product | text | not null |
| card_number | text | not null |
| parallel_name | text | nullable |
| print_run | integer | nullable |
| is_auto | boolean | not null, default false |
| is_rookie | boolean | not null, default false |
| condition | enum(Mint, Excellent, Good, Poor) | not null |
| grade | numeric | nullable |
| grader | enum(PSA, BGS, SGC, None) | nullable |
| photos | text[] (URLs, e.g. Vercel Blob/S3) | not null, default '{}' |
| acquisition_price | numeric | not null, default 0 |
| acquisition_date | date | not null |
| status | enum(in-stock, listed, sold) | not null, default 'in-stock' |
| estimated_value | numeric | nullable |
| value_estimate_detail | jsonb | nullable — shape = `ValueEstimate` (§Claude Contract) |
| notes | text | nullable |
| version | integer | not null, default 0 — **optimistic concurrency**, see below |
| created_at / updated_at | timestamptz | not null, default now() |

Indexes: `(user_id, status)`, `(user_id, player)`, `(user_id, sport)` for Collection filtering/search.

### `ebay_listings`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| card_id | uuid | FK → cards.id, not null, cascade delete |
| ebay_listing_id | text | nullable (set only on publish — see below) |
| ebay_offer_id | text | nullable (set on draft creation — this is what the app tracks pre-publish; **not** in the brief's schema table verbatim but required to call `publishOffer` later, so added here) |
| title | text | not null |
| start_price | numeric | nullable |
| buy_now_price | numeric | nullable |
| status | enum(draft, active, sold, ended-unsold) | not null, default 'draft' |
| listed_date | date | nullable |
| ended_date | date | nullable |
| views | integer | nullable |
| watchers | integer | nullable |
| last_synced | timestamptz | nullable |
| version | integer | not null, default 0 — **optimistic concurrency, explicitly required by the brief** for status/views/watchers |
| created_at / updated_at | timestamptz | not null, default now() |

Index: `(card_id)`.

### `lookups`
Same card-shape fields as `cards` (sport…condition) but **no `user_id`-scoped inventory semantics** — plus:
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | text | FK → users.id, not null |
| estimated_value | numeric | nullable |
| value_estimate_detail | jsonb | nullable |
| looked_up_at | timestamptz | not null, default now() |
| asking_price | numeric | nullable |
| buy_signal | enum(good-buy, fair, walk-away) | nullable |
| converted_card_id | uuid | FK → cards.id, nullable |
| created_at | timestamptz | not null, default now() |

Index: `(user_id, looked_up_at desc)` for Recently Looked Up.

### `sales`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| card_id | uuid | FK → cards.id, not null |
| ebay_listing_id | uuid | FK → ebay_listings.id, nullable |
| sale_price | numeric | not null |
| sale_date | date | not null |
| platform | enum(eBay, other) | not null |
| fees | numeric | nullable |
| shipping_cost | numeric | nullable |
| net_profit | numeric | **generated/derived at write time** (`sale_price - fees - shipping_cost - card.acquisition_price`), stored (not a Postgres generated column, since it depends on a joined table's value) |
| buyer_notes | text | nullable |
| created_at | timestamptz | not null, default now() |

Index: `(card_id)`.

**Relationships:** `cards` 1—N `ebay_listings`; `cards` 1—0/1 `sales` (brief says "zero or one" — enforce in application logic, not a DB constraint, since a re-listed/re-sold card scenario isn't fully ruled out); `lookups` 0/1—0/1 `cards` via `converted_card_id`.

**Optimistic concurrency — explicit deviation note:** Per the `database-neon-drizzle` pattern's convention, `version` is applied to `cards` and `ebay_listings` (both get frequent small field updates — status changes, re-syncs, edits from multiple devices during a bulk-intake session). `lookups` and `sales` do **not** get a `version` column — they're effectively write-once-then-rarely-edited (a lookup's only post-create mutation is `asking_price`, single-actor in practice; a sale record is edited rarely, long after creation). This is a deliberate deviation from "every mutable table" and is flagged in §7 Open Questions for sign-off rather than applied silently.

---

## 5. API Routes

All routes require an authenticated session (`auth()` check, 401 otherwise) unless noted. All mutating routes on `cards`/`ebay_listings` require `expectedVersion` in the body and return `409` on conflict, per the pattern.

### Recognition (two distinct flows — see §Recognition Pipeline below)
| Route | Method | Auth | Body/Query | Returns | Touches |
|---|---|---|---|---|---|
| `/api/recognize/vision` | POST | yes | image (base64/blob) | candidate `CardAttributes` + per-field confidence | none (no persistence) |
| `/api/recognize/cert` | POST | yes | `{ certNumber, grader }` | authoritative `CardAttributes` (from PSA) | none (no persistence) |

### Value estimation
| Route | Method | Auth | Body | Returns | Touches |
|---|---|---|---|---|---|
| `/api/estimate` | POST | yes | `{ card: CardAttributes }` | `ValueEstimate` (§Claude Contract) | none (pure function endpoint — caller persists) |

### Collection (Card)
| Route | Method | Auth | Body/Query | Returns | Touches |
|---|---|---|---|---|---|
| `/api/cards` | GET | yes | `?status=&sport=&q=` | list of user's cards | cards |
| `/api/cards` | POST | yes | full Card fields + `ValueEstimate` from `/api/estimate` | created card | cards |
| `/api/cards/[id]` | GET | yes | — | full card | cards |
| `/api/cards/[id]` | PATCH | yes | `{ expectedVersion, ...fields }` | updated card / `409` | cards |
| `/api/cards/[id]` | DELETE | yes | — | `{ deleted: true }` | cards |
| `/api/cards/[id]/estimate` | POST | yes | — | re-runs `/api/estimate`, PATCHes the card with new detail | cards |
| `/api/cards/export` | GET | yes | same filters as list | CSV stream | cards |

### Research (Lookup)
| Route | Method | Auth | Body | Returns | Touches |
|---|---|---|---|---|---|
| `/api/lookups` | GET | yes | `?limit=` | recent lookups | lookups |
| `/api/lookups` | POST | yes | Card-shape fields + `ValueEstimate` + optional `asking_price` | created lookup (with `buy_signal` computed server-side if `asking_price` present) | lookups |
| `/api/lookups/[id]` | PATCH | yes | `{ asking_price }` | updated lookup, recomputed `buy_signal` | lookups |
| `/api/lookups/[id]/convert` | POST | yes | `{ acquisition_price, acquisition_date }` | created card + updates `lookups.converted_card_id` | lookups, cards |

### eBay (draft/publish kept strictly separate — see §eBay Integration below)
| Route | Method | Auth | Body | Returns | Touches |
|---|---|---|---|---|---|
| `/api/ebay/listings` | GET | yes | — | tracked listings | ebay_listings |
| `/api/ebay/listings` | POST | yes | `{ card_id, title, start_price?, buy_now_price?, category_id }` | created **draft** row (calls Inventory API + Offer API `createOffer` only) | ebay_listings |
| `/api/ebay/listings/[id]` | PATCH | yes | `{ expectedVersion, title?, start_price?, buy_now_price? }` — draft-only edit | updated draft / `409` | ebay_listings |
| `/api/ebay/listings/[id]/publish` | POST | yes | `{ expectedVersion }` | published listing (calls `publishOffer`; this is the **only** route that does) | ebay_listings |
| `/api/ebay/sync` | POST | yes (or cron w/ system auth) | `{ listing_ids? }` (omit = sync all active for user) | updated listings | ebay_listings |
| `/api/ebay/aspects` | GET | yes | `?category_id=` | item aspects from Taxonomy API | none (passthrough) |

### Sales
| Route | Method | Auth | Body | Returns | Touches |
|---|---|---|---|---|---|
| `/api/sales` | GET | yes | — | sales history | sales |
| `/api/sales` | POST | yes | `{ card_id, ebay_listing_id?, sale_price, sale_date, platform, fees?, shipping_cost?, buyer_notes? }` | created sale (server computes `net_profit`), sets `cards.status = 'sold'` | sales, cards |
| `/api/sales/[id]` | PATCH | yes | partial fields | updated sale, recomputed `net_profit` | sales |

### Dashboard / reference data
| Route | Method | Auth | Query | Returns |
|---|---|---|---|---|
| `/api/dashboard/stats` | GET | yes | — | inventory value, profit/loss, counts by status, computed live from `cards`+`sales` |
| `/api/tcdb/checklist` | GET | yes | `?sport=NFL\|NBA` | checklist entries (players/sets/parallels), server-cached from TCDB, also the payload the service worker caches client-side (§PWA) |

---

## 6. Architectural Deep-Dives

### Recognition Pipeline — two distinct server-side flows
These are genuinely different operations and must not share one endpoint:
1. **Vision flow** (`/api/recognize/vision`) — image in, uncertain-by-nature output. Calls Google Cloud Vision's object localization to crop/locate the card in frame, then text detection/OCR on the cropped region. `lib/recognition/visionClient.ts` returns raw OCR tokens; a separate parser (`lib/recognition/parseVisionResult.ts`) maps tokens to `CardAttributes` fields with a per-field confidence score (e.g. player name matched against a known-name list = high confidence; year/card_number as free OCR digits = lower). This is probabilistic and **always** routes to Review for confirmation — never auto-saves.
2. **Cert flow** (`/api/recognize/cert`) — a scanned PSA/BGS/SGC barcode or QR decodes client-side (e.g. via a barcode-reading library in CameraView) to a cert number, which is sent to the server for a **lookup by exact key**, not image inference. `lib/recognition/psaCertLookup.ts` defines an adapter interface (`lookupCert(certNumber): Promise<CardAttributes & { grade, grader }>`) so the calling code doesn't care whether the real implementation is a public API call or something else — see §7 Open Questions, this is genuinely unresolved and the interface exists precisely so nothing downstream is blocked on the answer. Confidence is implicitly "authoritative" (no confidence score needed) since it's PSA's own record, but Review still shows it for the user to confirm nothing was mis-scanned (wrong cert number typo, etc.).

Both flows return the same `CardAttributes` shape so Review/ManualCorrectionForm and everything downstream is agnostic to which path produced it — the divergence is entirely inside `/api/recognize/*`.

### Shared Pipeline — Collection vs. Research
Both Scan (Collection-bound) and Research follow: **identify → estimate → [persist]**. The first two steps are identical code, in `lib/pipeline/identifyAndEstimate.ts`:
```
identifyAndEstimate(input: VisionImage | CertNumber): Promise<{ card: CardAttributes; estimate: ValueEstimate }>
```
This function calls the appropriate `/api/recognize/*` logic directly (server-side, not an HTTP round-trip to itself) then `lib/estimate/claudeEstimate.ts`. Neither step persists anything.

**Where they diverge — persistence only:**
- **Collection**: Review page calls this pipeline, user edits/confirms, then `POST /api/cards` persists into `cards` with `acquisition_price`/`acquisition_date`/`status: in-stock`. No `asking_price`/`buy_signal` concept exists here.
- **Research**: Research page calls the same pipeline, then `POST /api/lookups` persists into `lookups` — no acquisition fields, no `status`. If the user enters `asking_price`, the server computes `buy_signal` via `lib/estimate/buySignal.ts` (ported from card-ladder's `bidCeiling.ts` threshold logic: below range = good-buy, within range = fair, above range = walk-away). "Add to Inventory" (`/api/lookups/[id]/convert`) is the only bridge — it takes the already-computed `estimate` from the lookup, asks the user for `acquisition_price`/`acquisition_date` at that moment, and creates a real `cards` row, setting `lookups.converted_card_id`.

Net effect: one identification+estimation implementation, two thin persistence branches. `asking_price`/`buy_signal` are Research-only by construction (the field doesn't exist on `cards` at all).

### eBay Integration — draft and publish as separate, independently-triggered actions
This is a hard requirement from the brief and is enforced at the API-route level, not just in UI copy:
- `lib/ebay/inventoryApi.ts` exports `createOrReplaceInventoryItem()`.
- `lib/ebay/offerApi.ts` exports **two separate functions**: `createOffer()` and `publishOffer()`. They are never called from the same request handler.
- `POST /api/ebay/listings` calls `createOrReplaceInventoryItem()` + `createOffer()` only, writes `ebay_listings.status = 'draft'` and stores the returned `offerId` as `ebay_offer_id`. It does **not** call `publishOffer`.
- `POST /api/ebay/listings/[id]/publish` is a distinct route, triggered only by an explicit user click on `PublishListingButton` (with a confirmation dialog), and is the only code path that calls `publishOffer()`. On success it sets `status = 'active'`, `listed_date = now()`, and stores the real `ebay_listing_id`.
- Frontend enforces the same separation visually: `CreateDraftListingButton` and `PublishListingButton` are two separate components in two separate render states (Publish only appears once a draft row exists with `status: 'draft'`).
- `POST /api/ebay/sync` polls `getOffer`/`getListing`-equivalent status for all `active` listings and updates `views`/`watchers`/`status`/`last_synced`, using the `version` column (bump on every sync write; a concurrent user PATCH to the same row during a sync would get a `409` and refetch, per the pattern).

### Claude API — Value-Estimation Request/Response Contract
**Comp sourcing decision (resolves former Open Question #1):** Claude sources its own comps via the Anthropic-hosted **web search tool** (`web_search_20260209`), rather than the app pre-fetching comp data through a separate pipeline. `lib/estimate/claudeEstimate.ts` calls the Messages API with `web_search_20260209` (and `web_fetch_20260209` for reading a specific found listing in full) declared in `tools`, and a system prompt that:
1. Instructs Claude to search for **completed/sold** listings for the exact card (player, set, parallel, print run, grade) across eBay sold listings, 130point, and PSA Auction Prices Realized.
2. **Hard rule, stated explicitly and repeated in the prompt:** an active "Buy It Now" or "asking price" listing is never a comp — only a confirmed completed sale counts. This is the single most important instruction in the prompt, directly carried over from the card-ladder project's own domain method ("never treat an active listing as a sale").
3. When direct comps are thin/absent (expected for low print-run parallels), searches for 3–5 reference players in the same set/product at the anchor and target tiers, to run the cross-player/tier-curve triangulation method from card-ladder.
4. Only after gathering evidence, responds with the structured JSON output below — every `reference_breakdown` entry must cite what it found (title, price, sale date/"active — excluded", source URL), so a bad web-search result is auditable rather than silently baked into the number.

This is an **agentic tool-use call** (Claude may search multiple times before answering), not a single-shot structured-output request — `claudeEstimate.ts` runs the tool loop (via the SDK's tool runner) until Claude produces its final structured answer, then that answer is zod-validated same as before. `lib/estimate/compSourcing.ts` (the separate pre-fetch adapter) is **removed from the plan** — no longer needed.

Request shape (assembled server-side, sent as the user turn):
```jsonc
{
  "card": { /* CardAttributes: sport, player, team, year, manufacturer, product,
               card_number, parallel_name, print_run, is_auto, is_rookie,
               condition, grade?, grader? */ }
}
```

Response — enforced via Anthropic structured outputs (JSON schema passed as a tool definition), validated again with zod server-side before storage:
```jsonc
{
  "range": { "low": number, "mid": number, "high": number },
  "confidence": "high" | "medium" | "low",
  "reference_breakdown": [
    {
      "type": "direct_comp" | "reference_player",
      "label": "string",              // e.g. "2024 Topps Chrome #150 PSA 10, sold $42"
      "source": "string",              // e.g. "eBay sold listing", "reference: Player X tier-step"
      "price": number | null,
      "sale_date": "YYYY-MM-DD" | null,
      "weight": number,                // relative contribution to the estimate, 0–1
      "note": "string"
    }
  ],
  "divergence_flag": { "flagged": boolean, "reason": "string | null" },
  "caveats": ["string", "..."]
}
```
This exact shape is what's stored verbatim in `cards.value_estimate_detail` / `lookups.value_estimate_detail` (jsonb), plus `estimated_value = range.mid` mirrored into the flat numeric column for sorting/filtering/dashboard aggregation. `ValueEstimateBreakdown` renders every field: the range as a bar, `confidence` as a badge, `reference_breakdown` as a table (each row links out to its source URL, since it's now live web-search evidence, not internal data), `divergence_flag` as a warning banner when true, `caveats` as a bulleted list — plus a caveat is auto-added whenever web search turns up thin/no results, so "insufficient data" surfaces honestly rather than Claude guessing. Model default: `claude-opus-4-8` per the brief's stated default (reasoning quality matters more than per-scan cost at "near-free" volume); revisit `claude-sonnet-5` only if per-scan cost becomes a real constraint at higher volume. Note web search adds a few seconds of latency per estimate (multi-turn tool loop) — acceptable for an on-demand per-card action, not something to background/batch.

### PWA — concrete caching and offline-queue behaviour
**What's precached (Workbox, app-shell strategy):** JS/CSS bundles, `/offline.html` fallback, static icons/manifest. Cache-first, versioned by build hash (standard `next-pwa` behaviour).

**What's cached for offline manual entry:** `GET /api/tcdb/checklist?sport=NFL` and `?sport=NBA` responses — cache-first with a background revalidate (stale-while-revalidate), refreshed opportunistically whenever the app has connectivity, so the checklist used for `ManualCorrectionForm`'s TCDB dropdowns is available even on dead venue wifi/cell signal. The raw checklist is also written into IndexedDB (not just the HTTP cache) so `lib/tcdb/searchIndex.ts` can build its normalized/debounced search index the same way whether the data came from a live fetch or the cache.

**What is genuinely NOT available offline, by nature of the feature:** camera-based recognition (`/api/recognize/vision`) and cert lookup (`/api/recognize/cert`) both require network round-trips to third-party services with no on-device fallback — same for `/api/estimate` (Claude). ScanPage/ResearchPage detect offline via `useOnlineStatus` and switch to a disabled state with explanatory copy ("Recognition needs a connection — use manual entry below") rather than silently queuing a request that can never succeed offline.

**What queues for reconnect:** writes that don't depend on a live third-party call succeeding — i.e., a fully manually-entered Card (sport/player/team/etc. typed in via the offline-cached TCDB dropdowns, no recognition/estimate involved) can be saved offline. `lib/offlineQueue.ts` is a small IndexedDB-backed outbox: queued mutations (`POST /api/cards` with no `estimated_value`, `PATCH /api/cards/[id]` edits, `POST /api/sales`) are stored with a client-generated idempotency key, replayed in order on the browser's `online` event and on app foreground, and surfaced via `OfflineQueueIndicator`/`OfflineBanner` showing a pending count. This is a custom outbox rather than the Background Sync API specifically because Background Sync has no Safari/iOS PWA support, and iOS is a realistic device for a phone-in-hand shop/show use case.

---

## 7. Build Order

**Phase 0 — Scaffold (sequential, first)**
1. *(done)* `project-architect` — this document.
2. **backend-developer** — run `create-next-app`, copy in both patterns' files per §1a, merge `src/db/schema.ts` (auth tables + `cards`/`ebay_listings`/`lookups`/`sales` per §4), generate + commit the initial migration, write `.env.example` with all vars from §1a. Input: this plan §1a/§4.
3. **backend-developer** — wire `auth.ts`/`middleware.ts` (route-group protection for everything under `(app)/`), confirm Google OAuth env vars, verify sign-in round-trip locally against a Neon dev branch.
4. **backend-developer** — `db/seed.ts`: parse the user's 23-row spreadsheet into `cards`, generating a matching `ebay_listings` row (status inferred appropriately) for every `Listed: Yes` row using its Start/Buy Now price. Input: the spreadsheet (user to provide/confirm location), §4 schema.

**Phase 1 — Backend build-out (can parallelize across sub-areas once Phase 0 lands)**
5. **backend-developer** — `/api/recognize/vision` + `lib/recognition/visionClient.ts`/`parseVisionResult.ts`.
6. **backend-developer** — `/api/recognize/cert` + `lib/recognition/psaCertLookup.ts` as an adapter with a stub/mock implementation until §Open Questions' PSA access question resolves — does not block anything downstream since Review only needs the `CardAttributes` shape back.
7. **backend-developer** — `lib/estimate/claudeEstimate.ts` (Anthropic call with `web_search_20260209`/`web_fetch_20260209` tools, agentic tool loop, zod-validated structured final output per §Claude Contract — no separate comp-sourcing adapter needed), `/api/estimate`, `lib/pipeline/identifyAndEstimate.ts`.
8. **backend-developer** — `/api/cards/*` (CRUD + export), `/api/lookups/*` (CRUD + convert), `lib/estimate/buySignal.ts`, `/api/sales/*`, `/api/dashboard/stats`.
9. **backend-developer** — `lib/ebay/*` (auth token exchange, inventory/offer/taxonomy wrappers), `/api/ebay/listings` (draft only), `/api/ebay/listings/[id]/publish` (separate route — enforce per §eBay Integration), `/api/ebay/sync`, `/api/ebay/aspects`.
10. **backend-developer** — `/api/tcdb/checklist` (proxy + server-side cache).

**Phase 2 — Design & content (parallel with Phase 1, after Phase 0)**
11. **designer** — run `theme-factory` (brief: colours/fonts TBD); structurally reference Swappa's layout/login UX only, produce a distinct visual identity (no visual clone, per `design-fidelity.md`'s scope note — this is an original build from a brief, not a reference recreation).
12. **content-writer** — `content.md`: all form labels (manual entry, mark-sold, recognition-review/correction), CTA copy for the draft-vs-publish distinction (these must read as clearly different actions — "Create Draft Listing" vs. "Publish to eBay — this makes it live"), buy-signal labels, empty states, offline-mode explanatory copy.

**Phase 3 — Frontend build (needs Phase 0 always; needs the matching Phase 1 route for real data, but can scaffold against mocked responses earlier if schedule requires)**
13. **frontend-developer** — AppShell/BottomNav/OfflineBanner, root + `(app)` layouts, sign-in page.
14. **frontend-developer** — ScanPage + CameraView + ScanModeToggle, wired to `/api/recognize/*`.
15. **frontend-developer** — ReviewPage + ManualCorrectionForm (TCDB debounced dropdowns) + Save/`ScanNextButton` flow → `/api/cards`.
16. **frontend-developer** — ResearchPage (shares Scan/Review components) + AskingPriceInput/BuySignalBadge + RecentlyLookedUpList + AddToInventoryButton → `/api/lookups*`.
17. **frontend-developer** — CollectionPage (table/grid, filters, export, bulk actions).
18. **frontend-developer** — CardDetailPage — ValueEstimateBreakdown, ListingHistoryTable, MarkSoldForm, and the two visibly-separate CreateDraftListingButton/PublishListingButton controls.
19. **frontend-developer** — EBayListingsPage, DashboardPage.
20. **frontend-developer** — PWA: `manifest.json`, `next-pwa` config, TCDB checklist caching, `offlineQueue.ts` + indicators, offline-disabled states on Scan/Research.
21. **frontend-developer** — apply design spec (Task 11) and content (Task 12) across all pages once available.

**Phase 4 — QA and ship (last, steps 22–24 parallelizable)**
22. **ux-reviewer** — validate every flow in the brief's Key User Flows list end-to-end, specifically: rapid-fire scan-next never returns to a menu; Research never forces a save; the draft→publish gate is unambiguous in the UI (not just the API); offline manual entry actually works and queued items visibly sync on reconnect.
23. **code-reviewer** — focus on: `publishOffer` is genuinely unreachable from the draft-creation code path (grep for it, confirm single call site); `version`/`expectedVersion` concurrency correctly implemented on `cards`/`ebay_listings`; OAuth tokens (Google + eBay) never logged or exposed to the client; all third-party API keys server-side only.
24. **qa-tester** — full scan-to-sale flow, cert-lookup path, Research→convert path, offline manual-entry + reconnect sync, CSV export correctness, dashboard stat accuracy against seeded data.
25. **deployment** — provision Neon (dev/preview/prod branches), Vercel project + env vars per environment, Google/eBay OAuth redirect URIs for the real domain, `.github/workflows/ci.yml` (full-stack shape per `ci-cd.md`, migration step gated behind tests), `deployment.md`.

---

## 8. Open Questions

These need answers before the relevant build step can be considered done (not before the build starts — adapters/stubs let work proceed in parallel):

1. ~~Comp-sourcing for the Claude estimate is unspecified~~ **RESOLVED:** Claude sources its own comps live via the `web_search_20260209` (+ `web_fetch_20260209`) server tool during the `/api/estimate` call, searching eBay sold listings/130point/PSA APR directly — no separate comp-sourcing API or manual-entry UI needed for v1. Hard prompt rule: only completed sales count as comps, never active/asking listings. See §Claude Contract for the full mechanism.
2. **PSA cert lookup access is unresolved** (carried over verbatim from the brief's own Open Questions) — whether PSA exposes cert verification as a public API vs. a web-only verification page (which would conflict with the no-browser-automation principle applied to eBay). `lib/recognition/psaCertLookup.ts` is built as an adapter specifically so this doesn't block other work, but the real cert-scan flow doesn't function until this resolves.
3. **Exact eBay draft pre-fill scope** — the brief flags this as "to be confirmed during planning." Proposed default (needs sign-off, not yet confirmed): `buy_now_price` pre-filled from `estimate.range.mid`, `start_price` left blank/optional (fixed-price listings as the default format, not auction), `category_id`/aspects pre-filled via the Taxonomy API based on sport/manufacturer/product, all fields editable before draft creation. Confirm before frontend-developer builds `CreateDraftListingButton`'s pre-fill logic.
4. **`version` column deviation on `lookups`/`sales`** (see §4) — flagging the decision to *not* apply the pattern's optimistic-concurrency convention to these two tables, since they're write-once-then-rarely-edited in practice. Needs explicit sign-off since it's a deviation from "every mutable table gets `version`."
5. **eBay listing sync cadence** — brief says "periodically + on-demand" but doesn't specify a period. Needs a decision (e.g. hourly via Vercel Cron calling `/api/ebay/sync`) before deployment step wires up the cron job.
6. **Card Hedger / Soccer / UFC** — already deferred by the brief itself; no action needed for v1, carried forward here only so it isn't lost.
7. **Third-party credentials** — Google Vision, Anthropic, eBay (sandbox + production), TCDB, and (pending #2) PSA all need real accounts/keys provisioned per environment (dev/preview/prod, per `security.md`) before integration testing can move past stubs — flagging so this isn't discovered late at deployment time.

---

## Summary for the requester

First tasks to kick off:
1. **backend-developer**: scaffold the Next.js app and copy in the `auth-google-oauth` + `database-neon-drizzle` pattern files, merge `src/db/schema.ts` per §4, generate the initial migration.
2. **backend-developer**: wire auth end-to-end (Google OAuth sign-in working locally against a Neon dev branch) and write `db/seed.ts` against the user's 23-row spreadsheet.

Comp-sourcing (formerly the biggest open gap) is resolved — Claude sources its own comps live via web search during estimation, no separate pipeline needed. Remaining open items (§8) are all either non-blocking adapters/stubs (PSA cert lookup) or decisions that can be made during the relevant build step (eBay pre-fill scope, sync cadence).
