// Shared domain types — mirrors brief.md's Data Schemas and plan.md §4/§6.
// Used both as plain TS types and as the basis for zod schemas (kept
// alongside each consuming module rather than centralized, so validation
// stays next to the boundary it protects).

export type Sport = 'NFL' | 'NBA' | 'UFC' | 'Soccer';
export type Condition = 'Mint' | 'Excellent' | 'Good' | 'Poor';
export type Grader = 'PSA' | 'BGS' | 'SGC' | 'None';
export type CardStatus = 'in-stock' | 'listed' | 'sold';
export type EbayListingStatus = 'draft' | 'active' | 'sold' | 'ended-unsold';
export type BuySignal = 'good-buy' | 'fair' | 'walk-away';
export type SalePlatform = 'eBay' | 'other';

// ─────────────────────────────────────────────────────────────────────────
// CardAttributes — the shape returned by BOTH recognition flows
// (/api/recognize/vision and /api/recognize/cert), per plan.md §6
// "Recognition Pipeline". Everything downstream (Review, manual correction,
// /api/estimate) is agnostic to which flow produced it.
// ─────────────────────────────────────────────────────────────────────────

export interface FieldConfidence {
  value: unknown;
  confidence: number; // 0–1. Cert-flow fields are authoritative (1.0).
}

export interface CardAttributes {
  sport: Sport;
  league: string | null;
  player: string;
  team: string;
  year: string;
  manufacturer: string;
  product: string;
  card_number: string;
  parallel_name: string | null;
  // Free text, not necessarily numeric — most print runs are plain numbers
  // (e.g. "250"), but some parallels/special editions use lettered or
  // mixed codes (e.g. "1/1", "5B").
  print_run: string | null;
  is_auto: boolean;
  is_rookie: boolean;
  condition: Condition;
  grade: number | null;
  grader: Grader | null;
}

// Per-field confidence map returned alongside CardAttributes by the Vision
// flow (probabilistic — always routes to Review). The cert flow returns
// confidence 1 for every field since it's an authoritative PSA record.
export type CardAttributesConfidence = Partial<Record<keyof CardAttributes, number>>;

// ─────────────────────────────────────────────────────────────────────────
// ValueEstimate — the Claude value-estimation contract, per plan.md §6
// "Claude API — Value-Estimation Request/Response Contract" (revised).
// Stored verbatim in cards.value_estimate_detail / lookups.value_estimate_detail.
// ─────────────────────────────────────────────────────────────────────────

export interface ValueEstimateRange {
  low: number;
  mid: number;
  high: number;
}

export type ReferenceType = 'direct_comp' | 'reference_player';

export interface ReferenceBreakdownEntry {
  type: ReferenceType;
  label: string;
  source: string;
  // The actual URL Claude found this reference at (eBay sold listing,
  // 130point.com, PSA APR, etc.) — sourced from its web_search/web_fetch
  // results. Null when Claude can't attribute a specific URL (e.g. citing
  // an aggregate/trend rather than one page). Lets the UI link out to what
  // Claude actually found instead of just naming the source as text.
  url: string | null;
  price: number | null;
  sale_date: string | null; // "YYYY-MM-DD" | null (null = active/excluded or unknown)
  weight: number; // 0–1, relative contribution to the estimate
  note: string;
}

export interface DivergenceFlag {
  flagged: boolean;
  reason: string | null;
}

export type EstimateConfidence = 'high' | 'medium' | 'low';

export interface ValueEstimate {
  range: ValueEstimateRange;
  confidence: EstimateConfidence;
  reference_breakdown: ReferenceBreakdownEntry[];
  divergence_flag: DivergenceFlag;
  caveats: string[];
}
