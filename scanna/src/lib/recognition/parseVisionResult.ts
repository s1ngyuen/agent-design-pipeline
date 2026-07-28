// Maps raw Google Vision OCR tokens to CardAttributes fields with a
// per-field confidence score, per plan.md §6 "Recognition Pipeline":
//   "a separate parser maps tokens to CardAttributes fields with a per-field
//   confidence score (e.g. player name matched against a known-name list =
//   high confidence; year/card_number as free OCR digits = lower)."
//
// This is deliberately a heuristic, best-effort parser — it is NOT a
// substitute for a real card-recognition ML model or a full checklist
// cross-reference (that's TCDB's job for manual-entry dropdowns, which only
// covers NFL/NBA). Output always routes to Review for human confirmation;
// nothing here is ever auto-saved. Known-list matching (manufacturer,
// product, team) is intentionally small and extensible — expand the lists
// below as real inventory scans reveal gaps.

import type { CardAttributes, CardAttributesConfidence, Sport } from '@/domain/types';
import type { VisionRawResult } from './visionClient';

const MANUFACTURERS = ['Topps', 'Panini', 'Donruss', 'Upper Deck', 'Bowman', 'Leaf'];

const PRODUCTS = [
  'Chrome', 'Finest', 'Prizm', 'Select', 'Optic', 'Mosaic', 'Signature Series',
  'Contenders', 'Chronicles', 'Flagship', 'Stadium Club', 'Sterling', 'Immaculate',
  'National Treasures', 'Origins', 'Obsidian', 'Phoenix', 'Absolute',
];

// Small extensible seed list — not exhaustive. Real team cross-referencing
// for NFL/NBA ultimately comes from TCDB checklist data (manual-entry
// dropdowns), not this OCR heuristic.
const TEAMS_BY_SPORT: Record<Sport, string[]> = {
  NFL: [
    'Baltimore Ravens', 'Chicago Bears', 'Kansas City Chiefs', 'Dallas Cowboys',
    'Green Bay Packers', 'San Francisco 49ers', 'Philadelphia Eagles', 'Buffalo Bills',
  ],
  NBA: [
    'Los Angeles Lakers', 'Boston Celtics', 'Golden State Warriors', 'Miami Heat',
    'Milwaukee Bucks', 'Denver Nuggets', 'Phoenix Suns',
  ],
  UFC: [],
  Soccer: ['Paris Saint-Germain', 'Real Madrid', 'Manchester City', 'Bayern Munich'],
};

const AUTO_KEYWORDS = ['AUTOGRAPH', 'AUTO', 'SIGNATURE'];
const ROOKIE_KEYWORDS = ['ROOKIE', 'RC'];

const YEAR_RE = /\b(19|20)\d{2}(\/\d{2})?\b/;
const CARD_NUMBER_RE = /#\s?([A-Z]{0,4}-?\d+)/;
const PRINT_RUN_RE = /\b(\d{1,4})\s*\/\s*(\d{1,4})\b/;

export interface ParsedVisionResult {
  attributes: CardAttributes;
  confidence: CardAttributesConfidence;
  /** Raw OCR text, kept for debugging/manual-correction pre-fill context. */
  rawText: string;
}

function findKeyword(text: string, list: string[]): string | null {
  const upper = text.toUpperCase();
  return list.find((candidate) => upper.includes(candidate.toUpperCase())) ?? null;
}

function guessSport(text: string): { sport: Sport; confidence: number } {
  const upper = text.toUpperCase();
  if (TEAMS_BY_SPORT.NFL.some((t) => upper.includes(t.toUpperCase()))) return { sport: 'NFL', confidence: 0.7 };
  if (TEAMS_BY_SPORT.NBA.some((t) => upper.includes(t.toUpperCase()))) return { sport: 'NBA', confidence: 0.7 };
  if (TEAMS_BY_SPORT.Soccer.some((t) => upper.includes(t.toUpperCase()))) return { sport: 'Soccer', confidence: 0.6 };
  // Default guess — low confidence, Review must confirm.
  return { sport: 'NFL', confidence: 0.2 };
}

/**
 * Parses raw Vision annotations into CardAttributes + per-field confidence.
 * Always probabilistic — the caller (POST /api/recognize/vision) never
 * persists this result directly.
 */
export function parseVisionResult(raw: VisionRawResult): ParsedVisionResult {
  const text = raw.fullText ?? raw.textAnnotations.map((t) => t.description).join('\n');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const confidence: CardAttributesConfidence = {};

  const { sport, confidence: sportConfidence } = guessSport(text);
  confidence.sport = sportConfidence;

  const manufacturer = findKeyword(text, MANUFACTURERS);
  confidence.manufacturer = manufacturer ? 0.85 : 0.1;

  const product = findKeyword(text, PRODUCTS);
  confidence.product = product ? 0.8 : 0.1;

  const team = findKeyword(text, TEAMS_BY_SPORT[sport]);
  confidence.team = team ? 0.85 : 0.15;

  const yearMatch = text.match(YEAR_RE);
  confidence.year = yearMatch ? 0.6 : 0.1;

  const cardNumberMatch = text.match(CARD_NUMBER_RE);
  confidence.card_number = cardNumberMatch ? 0.65 : 0.1;

  const printRunMatch = text.match(PRINT_RUN_RE);
  confidence.print_run = printRunMatch ? 0.6 : 0.1;

  const isAuto = AUTO_KEYWORDS.some((kw) => text.toUpperCase().includes(kw));
  confidence.is_auto = isAuto ? 0.75 : 0.5; // absence isn't strong evidence either way

  const isRookie = ROOKIE_KEYWORDS.some((kw) => text.toUpperCase().includes(kw));
  confidence.is_rookie = isRookie ? 0.7 : 0.5;

  // Player name: best-effort — the longest line that isn't the team,
  // manufacturer, product, or a pure-number/year line. Low confidence by
  // construction since there's no name-list cross-reference here.
  const playerCandidate = lines
    .filter((line) => {
      const upper = line.toUpperCase();
      if (team && upper.includes(team.toUpperCase())) return false;
      if (manufacturer && upper.includes(manufacturer.toUpperCase())) return false;
      if (product && upper.includes(product.toUpperCase())) return false;
      if (YEAR_RE.test(line) || CARD_NUMBER_RE.test(line) || PRINT_RUN_RE.test(line)) return false;
      return /[A-Za-z]/.test(line);
    })
    .sort((a, b) => b.length - a.length)[0];
  confidence.player = playerCandidate ? 0.35 : 0.05;

  const attributes: CardAttributes = {
    sport,
    league: sport === 'Soccer' ? null : null, // league is manual-entry-confirmed either way
    player: playerCandidate ?? '',
    team: team ?? '',
    year: yearMatch ? yearMatch[0] : '',
    manufacturer: manufacturer ?? '',
    product: product ?? '',
    card_number: cardNumberMatch ? `#${cardNumberMatch[1]}` : '',
    parallel_name: null,
    print_run: printRunMatch ? Number(printRunMatch[2]) : null,
    is_auto: isAuto,
    is_rookie: isRookie,
    condition: 'Excellent', // neutral default — self-assessed, always confirmed in Review
    grade: null,
    grader: null,
  };
  confidence.condition = 0.1; // pure placeholder, always requires human confirmation

  return { attributes, confidence, rawText: text };
}
