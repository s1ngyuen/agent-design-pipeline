# Scanna — Content

Source: `brief.md` (dated 2026-07-27), `plan.md`. Written for a single card-reselling business owner (multi-user architecture, single-owner usage today) — someone who knows cards cold but wants the app to be honest and fast, not flashy.

---

## Tone of Voice — 3 Rules

1. **Talk like a sharp shop employee, not a fintech app.** Plain, confident, specific ("2 comps found, both 4+ months old" beats "limited data available"). No hype, no exclamation points, no "unlock," "empower," "seamless."
2. **Every irreversible action gets irreversible-sounding words.** Reversible actions ("save," "draft," "add") stay quiet and low-stakes. The one truly irreversible action (publishing to eBay) is the only place the copy is allowed to sound serious.
3. **Never claim certainty the system doesn't have.** Value estimates are framed as reasoned judgments with visible evidence, not verdicts. Confidence levels, comp counts, and caveats are always shown next to a number, never hidden behind it.

---

## Global / Navigation

### Bottom Navigation (labels, 1–2 words)
- Scan
- Research
- Collection
- Listings
- Dashboard

### Header contextual actions
- Default page title = page name (e.g. "Collection," "Dashboard")
- Review page header action: `Scan Next`
- Card Detail header action: `Edit Card`

### Footer / app tagline
```
Scanna — scan it, know what it's worth, decide for yourself.
```

### Repeated UI labels
- `Read more` → not used (no long-form content); use `View details` on cards/rows instead
- `Back to top` → not used (mobile-first, short pages)
- `Load more` (Recently Looked Up list, Sales History table, Listings table when paginated)
- `Retry`
- `Cancel`
- `Save changes`
- `Saved.` (toast, generic success)
- `Something didn't save — try again.` (toast, generic error)

### Offline Banner (global, shown whenever `useOnlineStatus` is false)
**Headline:**
```
You're offline
```
**Body (default state, no queued items):**
```
Recognition and value estimates need a live connection, so those are paused for now. Manual entry still works — your TCDB checklists are cached, and anything you save will sync the moment you're back online.
```
**Body (with queued items, count from `useOfflineQueue`):**
```
{n} card{s} saved offline and waiting to sync. They'll upload automatically as soon as you're back online — nothing is lost.
```
**Reconnected toast (transient, on `online` event with a queue that just cleared):**
```
Back online. {n} card{s} synced.
```

---

## Sign-In / Landing Page (`app/page.tsx`)

Structurally Swappa-inspired (single-column, calm, one clear action above the fold) — visual identity is the designer's call, this is the copy for it.

**Page title (`<title>`, 50–60 chars):**
```
Scanna — Scan Cards, Know Their Value, Sell Smarter
```

**Meta description (150–160 chars):**
```
Scan a sports card to identify it, get a researched value estimate, and manage your whole resale inventory — from acquisition to eBay sale.
```

**Hero H1:**
```
Point your phone at a card. Know what it's worth.
```

**Subheading:**
```
Scanna identifies your cards, researches real recent sales, and gives you a value estimate you can actually see the reasoning behind — then helps you list, track, and sell on eBay when you're ready.
```

**Primary CTA:**
```
Sign in with Google
```

**Secondary microcopy under CTA:**
```
Your inventory is private to your account. Nothing here is shared or traded with other users.
```

**Small trust/orientation line (Swappa-style secondary block, 3 short items — not full marketing sections, this is a utility login page):**
```
· Scan or manually enter — your call
· Every value estimate shows its sources and confidence
· Nothing goes live on eBay until you say so
```

**Sign-in error state (OAuth failure):**
```
Couldn't sign you in. Check your connection and try again — if this keeps happening, the Google sign-in service may be temporarily down.
```
`[Try again]`

---

## Scan Page (`/scan`)

**Page title:**
```
Scan a Card — Scanna
```
**Meta description:**
```
Hold a card up to your camera to identify it instantly, or scan a PSA/BGS cert barcode for an exact match.
```

**H1 (visually minimal — camera view is the content):**
```
Scan a card
```

**Mode toggle (ScanModeToggle) labels:**
- `Auto-ID` (camera OCR recognition)
- `Cert Barcode` (PSA/BGS/SGC scan)

**Helper copy under each mode (shown briefly / on first use):**
- Auto-ID: `Center the card in frame, good light helps. We'll read the front and confirm with you before anything is saved.`
- Cert Barcode: `Scan the barcode or QR code on the slab label. Graded cards get an exact match — no guessing.`

**Capture button label:**
```
Capture
```

**Recognition-in-progress overlay:**
```
Reading the card...
```

**Recognition failure (Vision API returned nothing usable):**
```
Couldn't get a clear read. Try better lighting, hold it steadier, or enter this one manually.
```
`[Try again]` `[Enter manually]`

**Cert-lookup failure (cert number not found / lookup service unavailable):**
```
That cert number didn't match anything. Double-check the number, or enter the card manually — you can add grade/grader by hand.
```
`[Try again]` `[Enter manually]`

**Offline / disabled state (per plan.md §PWA — recognition genuinely doesn't work offline):**
```
Recognition needs a connection

Auto-ID and cert lookup both call out to services that only work online. You're offline right now, so scanning is paused — but manual entry works fine and syncs automatically once you're back.
```
`[Enter manually instead]`

---

## Review Page (client-routed state off Scan/Research, per plan.md §3)

**H1:**
```
Confirm this card
```
**Subheading (Auto-ID path):**
```
Here's what we read. Check each field — anything we're not sure about is flagged.
```
**Subheading (Cert path):**
```
Matched from the cert number. This comes straight from the grading company's record, but give it a quick look before saving.
```

### Field Confidence Badges
- `High confidence` (neutral badge, no color-as-verdict — just a label)
- `Check this` (medium/low confidence — invites a glance, doesn't alarm)
- `From cert record` (cert-path fields — authoritative, but still shown, never silently trusted per plan.md §Recognition)

**Microcopy under the field list (Auto-ID path):**
```
This is our best read of the card, not a guarantee. Fix anything that's wrong before you save.
```

**Microcopy under the field list (Cert path):**
```
Grade, player, and set come directly from {grader}'s certification record. If something looks off, it's worth double-checking the cert number was scanned correctly.
```

### Manual Correction Form
- Section heading: `Fix any details`
- Sport field: `Sport` — dropdown (NFL, NBA, UFC, Soccer)
- **UFC selected state (not yet supported — explicit, not hidden):**
  ```
  UFC isn't fully supported yet

  We don't have checklist data for UFC cards yet, so there's no dropdown to pick from. You can still save this card — just fill in the player, set, and card number by hand below, and we'll treat every field as free text.
  ```
- Player: `Player` — TCDB-backed combobox (NFL/NBA), free-text (Soccer/UFC)
- Team: `Team`
- Year: `Year` — placeholder: `e.g. 2025 or 2025/26`
- Manufacturer: `Manufacturer` — placeholder: `Topps, Panini, ...`
- Product/Set: `Product / Set` — placeholder: `Chrome, Prizm, Finest, ...`
- Card Number: `Card #` — placeholder: `#140`
- Parallel: `Parallel (if any)` — placeholder: `Magenta, Green Geometric, ...`
- Print Run: `Print run (if numbered)` — placeholder: `/250`
- Auto: `Autographed` (toggle)
- Rookie: `Rookie card` (toggle)
- Condition: `Condition` — dropdown (Mint, Excellent, Good, Poor) — helper text: `Your own honest read — not a professional grade.`
- Grade: `Professional grade` — shown only if a grader is selected
- Grader: `Graded by` — dropdown (PSA, BGS, SGC, None)

**TCDB dropdown empty/no-match state:**
```
No match in our NFL/NBA checklist — you can still type it in, it'll just be saved as free text.
```

**TCDB dropdown offline state:**
```
Using your cached checklist (may be a few days old) since you're offline.
```

**Validation errors:**
- Missing required field: `{Field} is required.`
- Year format: `Enter a year like 2025 or 2025/26.`
- Print run: `Print run should be a number, like 250.`
- Grade without grader: `Pick who graded it, or clear the grade field.`

**Save button (Collection path):**
```
Save to Collection
```
**Save button (Research path — no acquisition fields required):**
```
Get Value Estimate
```

**Save success toast:**
```
Card saved to your Collection.
```

**Scan Next button (rapid-fire bulk intake — the whole point is speed, not closure):**
```
Scan Next →
```
Helper microcopy directly under it (shown briefly after first save in a session):
```
Straight back to the camera — keep going through the box.
```

---

## Research Page (`/research`)

**Page title:**
```
Research a Card's Value — Scanna
```
**Meta description:**
```
Scan or enter a card to check its value before you buy — no need to add it to your inventory.
```

**H1:**
```
Check a card before you buy it
```
**Subheading (sets Research apart from Collection explicitly — requirement #4):**
```
This is a quick look, not a commitment. Scan a card at a shop or show, see what it's worth, and decide — nothing gets saved to your inventory unless you choose to add it.
```

**Camera view reuses Scan's copy** (same CameraView component). Mode toggle and capture button labels are identical to Scan.

### Asking Price section (once an estimate exists)
**Heading:** `What's it going for?`
**Field label:** `Seller's asking price`
**Placeholder:** `$0.00`
**Helper text:** `Enter what's on the tag or what the seller quoted you — we'll weigh it against the estimate.`
**Button:** `Check the price`

### Buy Signal (requirement #2 — no financial/trading language, no gain-loss color framing)
Framed throughout as a **collector judgement call**, never a financial buy/sell instruction. No "BUY" / "SELL" verbs as commands, no green-means-gain/red-means-loss coding (final colors are the designer's call, but copy must not imply gain/loss framing even if color is added later).

**Badge labels (`BuySignalBadge` / requirement per plan.md §3 "non-financial-signal framing"):**
- `good-buy` → **"Below estimate"** — supporting microcopy: `The ask is under what recent sales suggest this card is worth. Worth a closer look if you want it.`
- `fair` → **"In line with estimate"** — supporting microcopy: `The ask lands inside the researched range — a reasonable price either way.`
- `walk-away` → **"Above estimate"** — supporting microcopy: `The ask is higher than recent sales support. Your call whether the card's worth it to you anyway.`

**Heading above the badge:** `How does this asking price compare?`
**Framing line above all three states (always shown, sets expectations):**
```
This compares the asking price to what we found — not advice on whether to buy. You know the card, the seller, and the moment better than we do.
```

**No asking price entered yet, estimate exists (empty state for this section):**
```
Add the asking price above if you want to see how it compares to the estimate.
```

### Recently Looked Up
**Section heading:** `Recently looked up`
**Empty state:**
```
Nothing here yet. Scan or enter a card above to check its value — it'll show up in this list.
```
**Row action:** `Add to Inventory`
**Row secondary text (per lookup):** `Looked up {relative time} · Est. ${range.low}–${range.high}`

### Add to Inventory (the bridge action — requirement #4)
**Dialog heading:**
```
Add to your Collection
```
**Dialog body:**
```
This turns your lookup into a real inventory item. Just need what you actually paid.
```
**Fields:**
- `Acquisition price` — placeholder `$0.00`, helper: `Enter $0 if it was a pack pull or already owned.`
- `Acquisition date` — defaults to today
**Confirm button:** `Add to Collection`
**Cancel:** `Not yet`
**Success toast:**
```
Added to your Collection.
```

---

## Collection Page (`/collection`)

**Page title:**
```
Your Collection — Scanna
```
**Meta description:**
```
Browse, search, and manage your full sports card inventory — status, estimated value, and quick actions in one place.
```

**H1:**
```
Your Collection
```
**Subheading:**
```
Every card you've added, with its current status and latest estimated value.
```

**Filter bar labels:**
- Search placeholder: `Search by player, set, or card #`
- Sport filter: `All Sports` (default) / NFL / NBA / UFC / Soccer
- Status filter: `All Statuses` (default) / In Stock / Listed / Sold

**Export button:** `Export CSV`
**Export helper (tooltip or subtext):** `Downloads the cards matching your current filters — handy for taxes or backups.`
**Export success toast:** `Your CSV is downloading.`
**Export error:** `Couldn't build the export — try again in a moment.`

**Bulk actions bar (when rows selected):**
- `{n} selected`
- `Mark Sold`
- `Delete`
- `Clear selection`

**Empty state (no cards at all):**
```
Your Collection is empty

Scan your first card, or add one manually, to start building your inventory.
```
`[Scan a Card]` `[Enter Manually]`

**Empty state (filters applied, no matches):**
```
No cards match these filters. Try widening your search or clearing a filter.
```
`[Clear filters]`

**Delete confirmation dialog:**
```
Delete this card?

This removes it from your Collection for good, including its value estimate and listing history. This can't be undone.
```
`[Delete]` `[Cancel]`

**Bulk delete confirmation:**
```
Delete {n} cards?

This removes all {n} from your Collection permanently, including their estimates and listing history. This can't be undone.
```
`[Delete {n} cards]` `[Cancel]`

**Status badges (neutral, non-financial):** `In Stock` / `Listed` / `Sold`

---

## Card Detail Page (`/collection/[id]`)

**Page title (dynamic):**
```
{player} — {year} {product} #{card_number} — Scanna
```
**Meta description (dynamic):**
```
Full record for this {player} card: acquisition details, value estimate breakdown, listing history, and eBay actions.
```

**H1 (dynamic):**
```
{year} {manufacturer} {product} — {player}
```
**Subheading (metadata line):**
```
{team} · #{card_number}{parallel_name ? " · " + parallel_name : ""}{print_run ? " /" + print_run : ""} · {condition}{grade ? " · " + grader + " " + grade : ""}
```

**Section headings:**
- `Card Details`
- `Value Estimate`
- `eBay Listing`
- `Listing History`
- `Sales`
- `Notes`

### Value Estimate Breakdown (requirement #3 — transparency)
**Heading:** `Value Estimate`
**Confidence badge labels:** `High confidence` / `Medium confidence` / `Low confidence`
**One-line explainer, always shown directly under the heading (this is the single most important trust-building sentence on the page):**
```
This is a researched estimate, not a guarantee — Claude searched recent sold listings and reasoned over what it found. Check the sources below before relying on it for a big decision.
```

**Range display label:** `Estimated range`
**Range sub-label:** `Most likely: ${range.mid}`

**Reference/comps table heading:** `What this is based on`
**Table column headers:** `Comp` / `Type` / `Sale Price` / `Sale Date` / `Source`
**Row type labels:** `Direct comp` / `Reference player` (tier-triangulation, thin-data case)
**Row link label:** `View listing →`
**"Active listing, not a sale" annotation (should this ever slip through, or for transparency about exclusions):**
```
Excluded — active listing, not a completed sale
```

**Divergence flag banner (shown only when `divergence_flag.flagged` is true):**
```
Heads up — two estimation approaches disagreed here

{divergence_flag.reason}

We've shown you the range anyway, but treat it as a wider guess than usual until more comps turn up.
```

**Caveats section heading:** `Worth knowing`
**Caveat list — bulleted, rendered verbatim from `caveats[]`.** Example placeholder caveats (for empty-data testing, marked clearly):
```
[PLACEHOLDER] Only 2 direct comps found for this exact parallel.
[PLACEHOLDER] The most recent comp is from 6 months ago — prices may have moved since.
[PLACEHOLDER] No graded comps found; this estimate assumes raw/ungraded condition.
```

**Thin-data / low-confidence extra framing (auto-added caveat context, shown as intro line above the caveats list when confidence is "low"):**
```
Not much to go on for this one. Take this estimate as a rough starting point, not a firm number.
```

**Re-run estimate button:** `Refresh Estimate`
**Re-run helper text:** `Runs the research again — useful if it's been a while or the market's moved.`
**Re-run loading state:** `Researching recent sales...` (this can take a few seconds — set expectations)
**Re-run failure:**
```
Couldn't complete the research this time. Your last estimate is still shown below — try again in a bit.
```

### eBay Listing Section — draft vs. publish (requirement #1, highest-stakes copy on the whole app)

**No listing yet — empty state:**
```
Not listed on eBay yet

When you're ready to sell, create a draft first. Nothing goes live until you explicitly publish it.
```

**Projected fees/profit preview (shown before listing, mirrors buy-side signal for the sell decision — per brief's Key User Flows):**
```
Heading: Before you list

At today's estimate (${range.mid}), after eBay's typical final value fee, you'd net roughly ${projected_net}. This is a projection based on the current estimate, not a guarantee of sale price.
```

**Create Draft button (safe, reversible, explicitly framed as NOT going live):**
```
Create Draft Listing
```
**Helper text directly beside/under the button:**
```
This only prepares a draft. It won't be visible on eBay until you publish it separately.
```

**After draft creation — draft state panel:**
**Heading:** `Draft ready — not live yet`
**Body:**
```
This draft exists only inside Scanna and your eBay seller account's unpublished offers — buyers can't see it. Review the details below, then publish when you're ready to go live.
```
**Editable draft fields (before publish):**
- `Listing title` — helper: `Auto-filled from the card's details. Edit it however you like before publishing.`
- `Start price` — helper: `Leave blank for a fixed-price listing.`
- `Buy It Now price` — helper: `Pre-filled from the value estimate — you can change it.`
- `Category` — auto-filled, editable

**Save draft edits button:** `Save Draft`
**Draft-edit success toast:** `Draft updated.`

**Publish button — the one irreversible action in the app. Must read as unmistakably different from every other button on this page:**
```
Publish to eBay
```
Button is visually and physically separated from `Create Draft Listing` / `Save Draft` (per plan.md §3 — two distinct components, distinct render states). It only appears once a draft exists.

**Publish confirmation dialog (this is the point-of-no-return moment — copy must not sound like a routine save):**
**Dialog heading:**
```
Publish this listing to eBay?
```
**Dialog body:**
```
This is the one step that actually goes live. Once you publish, your listing becomes visible to real buyers on eBay immediately, and this can't be undone from here — you'd need to end or revise the listing on eBay itself afterward.

Double-check the title, price, and photos below before continuing. Everything up to this point has been a draft only.
```
**Dialog fields recap (read-only summary shown inside the dialog, so the user confirms what they're about to publish):**
```
Title: {title}
Buy It Now: ${buy_now_price}
Category: {category}
```
**Confirm button (the actual trigger — deliberately not a generic "Confirm" or "Yes"):**
```
Yes, publish this listing
```
**Cancel button:**
```
Not yet — keep as draft
```
**Publishing-in-progress state:**
```
Publishing to eBay...
```
**Publish success (page updates to reflect the now-live listing):**
```
Live on eBay

Your listing is now public. Buyers can find and bid on or buy this card starting now.
```
**Publish failure (network/API error — draft is preserved, nothing was lost):**
```
Publish didn't go through

Something went wrong on eBay's end and the listing wasn't published. Your draft is untouched — check your eBay account connection and try again.
```
`[Try Publishing Again]` `[Keep as Draft for Now]`

**Version-conflict error (optimistic concurrency, `409` — e.g. edited on two devices):**
```
This draft changed somewhere else since you last loaded it. Refresh to see the latest version before publishing.
```
`[Refresh]`

### Mark Sold Form
**Heading:** `Mark as Sold`
**Fields:**
- `Sale price` — placeholder `$0.00`
- `Sale date` — defaults to today
- `Platform` — dropdown: eBay / Other
- `Fees` — helper: `Leave blank if you're not sure yet — you can edit this later.`
- `Shipping cost`
- `Buyer notes` — placeholder: `Optional — anything worth remembering about this sale.`
**Submit button:** `Mark Sold`
**Confirmation before submit (light confirm, this is reversible via edit, so lower stakes than publish):**
```
Mark this card sold? It'll move out of your active inventory and into your sales history. You can still edit the details afterward.
```
`[Mark Sold]` `[Cancel]`
**Success toast:**
```
Marked sold. Net profit: ${net_profit}.
```

### Edit Card Form
**Heading:** `Edit Card`
**Submit button:** `Save Changes`
**Success toast:** `Card updated.`
**Version-conflict error:** `This card was edited somewhere else — refresh to see the latest before saving your changes.`

### Notes section
**Empty state:** `No notes yet. Add anything worth remembering about this card.`
**Placeholder:** `e.g. bought at a show alongside 4 other rookies, seller was firm on price`

---

## eBay Listings Page (`/listings`)

**Page title:**
```
eBay Listings — Scanna
```
**Meta description:**
```
Track every card currently listed on eBay — status, price, views, and watchers, synced from your seller account.
```

**H1:**
```
Your eBay Listings
```
**Subheading:**
```
Everything you've published, with status and stats synced from eBay.
```

**Sync button:** `Sync Now`
**Sync in-progress:** `Syncing with eBay...`
**Sync success toast:** `Listings updated — {n} synced.`
**Sync failure:**
```
Couldn't reach eBay to sync. Your listings still show their last-known status from {last_synced}.
```

**Table column headers:** `Card` / `Status` / `Price` / `Views` / `Watchers` / `Listed` / `Last Synced`
**Status badges:** `Draft` / `Active` / `Sold` / `Ended — Unsold`

**Empty state:**
```
No listings yet

Once you publish a card from its Card Detail page, it'll show up here with live status, views, and watchers.
```
`[Go to Collection]`

**Row action:** `View Card`

---

## Dashboard Page (`/dashboard`)

**Page title:**
```
Dashboard — Scanna
```
**Meta description:**
```
Your resale business at a glance — inventory value, profit and loss, and sales history in one view.
```

**H1:**
```
Dashboard
```
**Subheading:**
```
A quick read on where your business stands right now.
```

**Stat cards:**
- `Total Inventory Value` — helper: `Sum of current estimates across all in-stock and listed cards.`
- `Total Profit` — helper: `Realized profit from everything sold so far.`
- `In Stock` — count
- `Listed` — count
- `Sold` — count

**Sales History section heading:** `Sales History`
**Table column headers:** `Card` / `Sale Price` / `Fees` / `Shipping` / `Net Profit` / `Date` / `Platform`

**Empty state (no sales yet):**
```
No sales yet

Once you mark a card sold, it'll show up here with profit calculated automatically.
```

**Empty state (no inventory at all — first-run dashboard):**
```
Nothing to show yet. Scan or add your first card to start seeing your numbers here.
```
`[Scan a Card]`

---

## Generic / System-Wide States

**404 page:**
```
H1: This page went missing

Whatever you were looking for isn't here. It might've moved, or the link might be off.

[Back to Collection]
```

**Generic error page (uncaught exception):**
```
H1: Something went wrong on our end

This wasn't your fault. Try reloading — if it keeps happening, your data is safe, it's just this page that's having trouble.

[Reload] [Back to Collection]
```

**Session expired:**
```
You've been signed out. Sign in again to pick up where you left off.
```
`[Sign in with Google]`

**Generic network error (any failed fetch not covered above):**
```
Couldn't connect. Check your connection and try again.
```
`[Retry]`

**Generic form validation:**
- Required field: `{Field} is required.`
- Invalid number: `Enter a valid number.`
- Invalid price: `Enter a price like 24.99.`
- Invalid date: `Enter a valid date.`

---

## Assumptions Made (flag for review)

1. **Buy Signal label wording** ("Below estimate" / "In line with estimate" / "Above estimate" as the visible badge text, with good-buy/fair/walk-away kept as internal enum values only) is my interpretation of "avoid financial/trading language" — the brief's own copy uses "good-buy/fair/walk-away" as the enum name, but I judged even those three phrases risk reading as buy/sell instructions once bolded on a badge, so the user-facing labels describe the *comparison*, not a directive. Worth a designer/product check — if the business owner wants the more literal "Good Buy / Fair / Walk Away" wording after all, swap it in; the supporting microcopy already does the "your call" framing either way.
2. **Projected fees/profit preview copy** on Card Detail (the "Before you list" section) is invented to satisfy the brief's Key User Flow ("see a projected eBay final-value fee and estimated net profit... before deciding to list") since plan.md doesn't specify exact wording — the numbers/format should be confirmed against whatever the real fee-calculation logic returns.
3. **UFC "not yet supported" copy** is a full explanatory microcopy block rather than the shorter version some apps use — I erred toward more explanation per the task's explicit ask, but it's the longest inline message in the manual-entry form and could be trimmed if it feels heavy in the actual layout.
4. **Publish confirmation dialog fields-recap** (title/price/category read-only summary inside the dialog) is my addition, not explicitly specified in plan.md — flagging in case frontend-developer prefers a lighter dialog without the recap.
5. **Empty caveats placeholders** in the Value Estimate section are marked `[PLACEHOLDER]` since real caveats come from live Claude output at runtime — these exist only so frontend-developer has example strings to lay out against.

## Note on `/Users/singyuen/Documents/agent/scanna/AGENTS.md`

That file (and the linked `CLAUDE.md` in the project folder) instructs reading `node_modules/next/dist/docs/` for a supposedly non-standard version of Next.js before writing code. This doesn't affect a content-writer task (no code was written here), but it's an unusual instruction worth the requesting agent's attention before any code-writing step (frontend-developer, backend-developer) proceeds — worth verifying that path actually exists and is legitimate rather than acting on it blindly.
