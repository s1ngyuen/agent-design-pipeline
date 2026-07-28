# Project Brief: Scanna

**Date:** 2026-07-27
**Status:** Draft

---

## Overview

Scanna is a card-reselling business tool: point a camera at a sports card, auto-identify it via computer vision, and store it in a searchable inventory database accessible from the web. Each card gets an AI-reasoned value estimate; the user reviews it and manually decides whether to push a listing to eBay — and even after that decision, a draft is created first and must be explicitly published. The app also tracks live eBay listings and full sales history (price, fees, profit) so the whole resale pipeline — acquisition through sale — lives in one place. Built mobile-first (as a PWA) since a core use case is standing in a card shop or at a show, scanning a card to check its value before deciding whether to buy — without necessarily adding it to inventory (see Research Mode).

**Primary Goal:** Give a card reseller a fast scan-to-inventory pipeline with defensible value estimates, while keeping the eBay-listing step a manual, reviewed decision rather than a fully automated one.
**Target Audience:** Built for a single card-reselling business owner today, architected for multiple users from day one (individual accounts, not a shared marketplace).

---

## Pages

| Page | Purpose |
|------|---------|
| Scan | Live camera view — hold a card up, trigger recognition |
| Review | Shows the identified card + confidence; confirm or correct (manual entry fallback) before saving |
| Research | Same scan → identify → value-estimate pipeline as Scan, but doesn't force saving to inventory — for checking a card's worth at a shop/show before deciding to buy. Result lands in Recently Looked Up; "Add to Inventory" converts it into a real Card if you decide to buy |
| Collection (Inventory) | Primary page — browse/search all cards, current status, estimated values; delete, mark sold, or export to CSV |
| Card Detail | Full record for one card: data, value-estimate breakdown, listing history, "list on eBay" action |
| eBay Listings | Tracks currently-live listings — status, price, views/watchers, synced from eBay |
| Dashboard | Business-level stats: total inventory value, profit/loss, sales history |

### Key User Flows
- Scan a card → auto-identify (or scan a PSA/BGS cert barcode/QR for graded cards — an exact ID lookup, no OCR guesswork) → review/confirm (or correct via sport-specific dropdown manual entry) → save to inventory
- **Rapid-fire bulk intake:** after saving a card, a "Scan Next" action returns straight to the camera instead of back to a menu — for entering a whole lot/box in one sitting without repeated navigation
- **Research mode:** scan a card (or cert barcode) → auto-identify → get value estimate → optionally enter the seller's asking price to get a **good-buy / fair / walk-away** signal (reusing the bid-ceiling logic from the card-ladder project) → no save required; entry appears in Recently Looked Up. Optionally convert to a real inventory Card ("Add to Inventory," fills in acquisition price/date) if you decide to buy
- View estimated value for a card → see a projected eBay final-value fee and estimated net profit against that value *before* deciding to list (mirrors the buy-side good-buy/fair/walk-away signal, but for the sell decision) → decide to list on eBay → app creates a **draft** listing via eBay's Sell API (Inventory + Offer API) — nothing goes live yet
- Review the draft (title, price, category, photos) on the Card Detail page → explicitly click "Publish to eBay" → app calls eBay's `publishOffer` endpoint, the one action that makes it live. This is the manual gate — listing creation never auto-publishes.
- Track a live eBay listing's status (active/sold/ended) synced back into the app
- Mark a card sold (price, platform, fees, shipping) → sales history + profit auto-calculated
- Edit acquisition cost, notes, or any card field after the fact
- Delete a card record
- Export the full inventory (or a filtered view) to CSV — for taxes, accounting, or backup

---

## Content & Data

| Content Type | Static / Dynamic | Update Frequency |
|---|---|---|
| Card inventory | Dynamic | Continuous — scanned/entered/edited/sold ad hoc |
| Recently Looked Up (research mode) | Dynamic | Created on every research-mode scan; not part of inventory unless converted |
| eBay Listings | Dynamic | Synced from eBay API periodically + on-demand |
| Sales history | Dynamic | Created whenever a card is marked sold |
| Card checklist reference (NFL/NBA sets, players, parallels) | Dynamic, externally sourced | Refreshed from TCDB API; not user-maintained |
| Business stats (dashboard) | Dynamic, derived | Computed from inventory + sales in real time |

**Authentication required:** Yes — Google OAuth, multi-user from day one (each user has their own private inventory; no cross-user marketplace/trading).
**Forms:** Manual card entry (sport-specific dropdowns: NFL/NBA fully backed by TCDB reference data, Soccer manual/free-text, UFC deferred); edit acquisition cost/notes/any field; mark-as-sold form (price, platform, fees, shipping, buyer notes); recognition-review/correction form.
**External data / APIs:**
- **Google Cloud Vision API** — object localization (find the card in frame) + text detection/OCR (read player/set info) as the recognition pipeline. Free tier: 1,000 units/month per feature; ~$1.50–2.25/1,000 after that — expected to stay near-free at this scale.
- **PSA cert verification lookup** — for professionally graded cards, scanning the cert barcode/QR and looking up the cert number gives an exact, non-OCR identification (player, set, grade all authoritative from PSA's record) instead of relying on Vision API guesswork. Whether PSA exposes this as a public API vs. only a web verification page needs confirming (see Open Questions) — same "let's research it" treatment as Card Hedger.
- **TCDB (Trading Card Database) API** — checklist/set/parallel reference data for NFL and NBA (covers Football/Baseball/Basketball/Hockey only — no Soccer/UFC, hence those being manual-only/deferred for v1).
- **eBay API (official Sell APIs — Inventory API + Offer API, OAuth)** — not browser automation. Drafts are created via the Inventory/Offer API and left unpublished; going live requires the user to explicitly hit "Publish to eBay," which calls the `publishOffer` endpoint — the manual gate lives at this API boundary. Taxonomy API (`getItemAspectsForCategory`) supplies category-correct item aspects; live listing status/view/watcher sync is polled from the same API family.
- **Anthropic Claude API** — the value-estimation reasoning layer. Takes the target card's attributes plus sourced comps (direct matches, or reference-player data for triangulation when direct comps are thin) and returns a structured estimate (range, confidence, reference breakdown, divergence flag, caveats) via structured outputs — it reasons over comp data, it does not source it.
- **Card Hedger** — flagged as a possible future source for Soccer/UFC checklist + pricing data; access requires a reply to an existing outreach thread (see Open Questions) — not a v1 dependency.

---

## Data Schemas

**Seed data approach:** Real data — user's existing 23-row spreadsheet of inventory, parsed into the schema below and imported as the initial dataset.

### Card

| Field | Type | Required |
|---|---|---|
| sport | enum (NFL, NBA, UFC, Soccer) | Yes |
| league | text, nullable (e.g. "FIFA World Cup", "UEFA" — soccer only) | No |
| player | text | Yes |
| team | text | Yes |
| year | text (supports "2025/26" style) | Yes |
| manufacturer | text (Topps, Panini, ...) | Yes |
| product | text (Finest, Chrome, Prizm, Signature Series, ...) | Yes |
| card_number | text | Yes |
| parallel_name | text | No |
| print_run | number, nullable (null for base/no print run) | No |
| is_auto | boolean | Yes |
| is_rookie | boolean | Yes |
| condition | enum (Mint, Excellent, Good, Poor — self-assessed) | Yes |
| grade | number, nullable (professional grade, if slabbed) | No |
| grader | enum (PSA/BGS/SGC/None), nullable | No |
| photos | image[] | Yes |
| acquisition_price | number (0 for pack pulls) | Yes |
| acquisition_date | date | Yes |
| status | enum (in-stock, listed, sold) | Yes |
| estimated_value | number, nullable | No |
| value_estimate_detail | json, nullable (range, confidence, references, caveats — from the Claude reasoning step) | No |
| notes | text | No |

**Relationships:** Belongs to a User. Has many eBay Listings (over time — relists, price changes). Has zero or one Sale.

**Sample data (transformed from user's spreadsheet):**
```
sport: NFL, player: Malaki Starks, team: Baltimore Ravens, year: 2025, manufacturer: Topps,
product: Signature Series, card_number: #140, parallel_name: Magenta, print_run: 250,
is_auto: false, is_rookie: false, condition: Mint, acquisition_price: 0.00

sport: NFL, player: Luther Burden III, team: Chicago Bears, year: 2025, manufacturer: Topps,
product: Finest, card_number: #27, parallel_name: Green Geometric, print_run: 75,
is_auto: false, is_rookie: true, condition: Excellent, acquisition_price: 5.00

sport: Soccer, league: UEFA, player: Warren Zaïre-Emery, team: Paris Saint-Germain,
year: 2025/26, manufacturer: Topps, product: Chrome, card_number: #FSA-WZ,
parallel_name: Future Stars Refractor, is_auto: true, is_rookie: false,
condition: Mint, acquisition_price: 5.00
```
Full 23-row spreadsheet to be parsed and imported in full during the build (`Listed: Yes` rows also generate a corresponding eBay Listing record using their Start/Buy Now price).

### eBay Listing

| Field | Type | Required |
|---|---|---|
| card | relation → Card | Yes |
| ebay_listing_id | text, nullable (until posted) | No |
| title | text (auto-generated from card fields, editable) | Yes |
| start_price | number | No |
| buy_now_price | number | No |
| status | enum (draft, active, sold, ended-unsold) | Yes |
| listed_date | date, nullable | No |
| ended_date | date, nullable | No |
| views | number, nullable | No |
| watchers | number, nullable | No |
| last_synced | datetime | No |

**Relationships:** Belongs to a Card. A Card may have multiple Listings over its lifetime.

### Lookup (Research Mode)

| Field | Type | Required |
|---|---|---|
| sport, player, team, year, manufacturer, product, card_number, parallel_name, print_run, is_auto, is_rookie, condition | same shape as Card | Yes (as identified) |
| estimated_value | number, nullable | No |
| value_estimate_detail | json, nullable | No |
| looked_up_at | datetime | Yes |
| asking_price | number, nullable (seller's price, if entered) | No |
| buy_signal | enum (good-buy/fair/walk-away), nullable — derived from estimate vs. asking_price | No |
| converted_card_id | relation → Card, nullable (set if "Add to Inventory" was used) | No |

**Relationships:** Belongs to a User. Optionally linked to the Card it was converted into.

### Sale

| Field | Type | Required |
|---|---|---|
| card | relation → Card | Yes |
| ebay_listing | relation → eBay Listing, nullable | No |
| sale_price | number | Yes |
| sale_date | date | Yes |
| platform | enum (eBay, other) | Yes |
| fees | number | No |
| shipping_cost | number | No |
| net_profit | number, derived (sale_price − fees − shipping_cost − acquisition_price) | — |
| buyer_notes | text | No |

**Relationships:** Belongs to a Card; optionally linked to the eBay Listing that closed it.

---

## Design Direction

**Brand colours:** TBD — to be generated via `theme-factory`.
**Fonts:** TBD — to be generated via `theme-factory`.
**Visual style:** Clean/utilitarian, structurally inspired by Swappa (layout patterns, login flow) but with a distinct visual identity — not a visual clone.
**Reference sites:** Swappa (layout/format and login UX specifically).
**Avoid:** Not yet specified — open to revisiting after first build.

---

## Technical Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, mobile-first responsive, built as a PWA (installable to home screen — the primary use case is standing in a shop/show with a phone). Service worker caches the TCDB checklist locally so manual entry keeps working on poor venue wifi/cell signal; recognition/valuation calls queue and retry when connectivity returns. |
| Backend | Next.js (API routes) |
| CMS | None |
| Database | Neon Postgres + Drizzle ORM |
| Hosting | Vercel |

**Integrations:** Google Cloud Vision API (card recognition), TCDB API (NFL/NBA checklist reference), eBay Sell API — Inventory + Offer + Taxonomy (draft/publish listing gate, item aspects, live listing sync), Google OAuth (auth), Anthropic Claude API (value-estimation reasoning, structured outputs — default `claude-opus-4-8`, revisit `claude-sonnet-5` if per-scan cost matters at volume).

---

## Feature Patterns

- `database-neon-drizzle` — Neon Postgres + Drizzle ORM, with optimistic-concurrency handling for frequently-synced fields (eBay listing status/views/watchers)
- `auth-google-oauth` — Google sign-in via NextAuth v5, multi-user from day one
- Not used: `trade-matching` (no peer-to-peer trading), `search-batch-add` (doesn't fit the one-card-at-a-time flow — though `project-architect` should still borrow its debounced/normalized search technique for the TCDB-backed manual-entry dropdowns)

---

## Constraints

**Timeline:** Not specified — no rush.
**Budget:** Not a concern per the user; Vision API costs expected to stay near-free at this scale.
**Scale / traffic expectations:** Single user today, architected for multi-user growth.

---

## Open Questions

- **Card Hedger access is unresolved** — an existing outreach thread (from the card-ladder project) hasn't been answered; Soccer/UFC checklist + pricing support depends on that reply (or an alternative source) and is deferred until then.
- **UFC support is fully deferred** — no checklist source identified yet; revisit later.
- **Soccer support is manual-entry only for v1** — TCDB doesn't cover it; dropdowns will be free-text/basic rather than checklist-validated.
- **Exact pre-fill scope for eBay listing creation** — e.g. auto-suggested start/BIN price from the Claude estimate? — to be confirmed during planning. The publish gate itself is settled: draft via Inventory/Offer API, explicit user action calls `publishOffer`.
- **PSA cert lookup access unresolved** — whether PSA exposes cert verification as a public API vs. only a web page to scrape (which would conflict with the "no browser automation" principle used for eBay) needs research before `project-architect` can plan the graded-card scan path in detail.
