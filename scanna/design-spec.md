# Design Spec: Scanna — "Slab Ink"

> No design-spec file existed in the project folder when frontend build started. Per the
> frontend-developer brief's fallback instructions, this document records the "Slab Ink" token
> system used to build the app, so it's persisted for future reference rather than re-invented
> per component. Colours/fonts below were supplied as the fallback direction; component
> treatments (BottomNav, CameraView, ValueEstimateBreakdown, BuySignalBadge, draft/publish
> distinction, OfflineBanner) are this build's concrete interpretation of that direction plus
> the explicit constraints already present in brief.md/plan.md/content.md (non-financial
> buy-signal framing, reserved irreversible-action styling for Publish, mobile card-per-reference
> collapse below 640px, mobile-bottom/desktop-sidebar nav).

## Colour tokens

| Token | Hex | Use |
|---|---|---|
| `bone` | `#FAF7F1` | App background |
| `bone-100` | `#F1EBDD` | Subtle section/card background, table stripes |
| `paper` | `#FFFFFF` | Elevated surfaces (cards, dialogs, inputs) |
| `ink` | `#1C1815` | Primary text, headings, primary buttons |
| `ink-70` | `#4A4038` | Secondary text |
| `ink-50` | `#756B62` | Tertiary/help text, placeholders |
| `border` | `#E4DDD0` | Hairline borders, dividers |
| `gold` | `#C08829` | Accent — primary CTA highlight, "below estimate" buy signal, focus rings |
| `gold-dark` | `#9C6C1F` | Gold hover/active |
| `gold-soft` | `#F3E3C4` | Gold badge background (paired with ink text) |
| `slate` | `#6E6A63` | Neutral secondary UI, "in line with estimate" glyph |
| `slate-soft` | `#E7E4DC` | Neutral badge background |
| `slate-700` | `#48453F` | Neutral solid buttons (secondary actions) |
| `plum` | `#6E3F52` | Reserved for the single irreversible action (Publish to eBay) + "above estimate" signal |
| `plum-dark` | `#54303F` | Plum hover/active |
| `plum-soft` | `#EDDEE3` | Plum badge background |
| `danger` | `#A23B2E` | Form validation errors / destructive confirmations only (delete) — distinct from plum |
| `danger-soft` | `#F6E2DE` | Danger badge/banner background |

No red/green gain-loss coding anywhere in Research Mode — BuySignalBadge uses gold/slate/plum
paired with a distinct glyph shape (▼ below estimate, ◆ in line, ▲ above estimate) so meaning
never depends on colour alone (accessibility.md).

## Typography

- Headings: **Space Grotesk** (`font-heading`)
- Body/UI: **Inter** (`font-sans`)
- Data/prices/card numbers/comps table: **IBM Plex Mono** (`font-mono`)

Loaded via `next/font/google` (self-hosted, no external request, `display: swap` built in).

## Spacing / radius

- Base radius: `0.5rem` (`rounded-lg`) for cards/inputs, `9999px` for badges/pills.
- Page container: `max-w-screen-lg mx-auto px-4` mobile, `px-6` from `md:`.
- Touch targets: min 44×44px on all interactive controls.

## Component treatments

- **BottomNav**: fixed bottom tab bar (5 items, icon + 1-word label) on mobile (`< lg`); becomes
  a fixed left sidebar (icon + label, vertical) at `lg:` and above. Active item uses `gold`
  underline/left-bar + `ink` text; inactive uses `ink-70`.
- **CameraView**: full-bleed `aspect-[3/4]` viewfinder on mobile, bone-bordered frame overlay,
  `paper` capture button with `gold` ring. Offline state replaces the viewfinder with a bone-100
  panel + explanatory copy (no camera permission prompt fired while offline).
- **ValueEstimateBreakdown**: range shown as a horizontal bar (`ink` fill from low→high, `gold`
  tick at mid) with numeric labels; confidence as a pill badge; reference table as a real
  `<table>` at `sm:` and above, collapsing to one bordered card per reference row below 640px
  (each card shows the same fields stacked, per the mobile note).
- **BuySignalBadge**: pill with glyph + label, coloured per the good-buy/fair/walk-away → gold/
  slate/plum mapping above; never a bare colour swatch.
- **Draft vs. Publish**: `CreateDraftListingButton`/`SaveDraft` use `ink` solid (routine, reversible
  action styling). `PublishListingButton` uses solid `plum` with a bold border and sits in its own
  bordered "point of no return" panel, visually separated from the draft controls, and always
  requires the confirmation dialog from content.md before firing.
- **OfflineBanner**: full-width `gold-soft` banner (not danger-red — offline is expected/normal,
  not an error state) fixed under the header, with pending-queue count.
