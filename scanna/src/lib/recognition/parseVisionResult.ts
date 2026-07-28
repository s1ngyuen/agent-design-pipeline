// Maps raw Google Vision OCR text to CardAttributes fields with a per-field
// confidence score, per plan.md §6 "Recognition Pipeline".
//
// The bulk of the interpretation work — manufacturer/product/team/player/
// sport/parallel/auto/rookie — is delegated to Claude (see
// claudeParseVisionText.ts): a hardcoded keyword list can never cover every
// manufacturer/product/team that exists, whereas Claude's language
// understanding (plus its training knowledge of real trading-card
// manufacturers, products, and team names) can actually make sense of noisy,
// jumbled OCR text the way a human collector would.
//
// year / card_number / print_run stay on cheap regex extraction: these are
// simple fixed patterns (a 4-digit year, a "#123" card number, an "X/99"
// serial number) that regex handles at least as reliably as an LLM call, so
// there's no reason to route them through Claude as the primary source —
// Claude's answer for the same field is only used as a fallback when the
// regex finds nothing.
//
// Output always routes to Review for human confirmation; nothing here is
// ever auto-saved.

import type { CardAttributes, CardAttributesConfidence } from '@/domain/types';
import type { VisionRawResult } from './visionClient';
import { parseCardTextWithClaude } from './claudeParseVisionText';

const YEAR_RE = /\b(19|20)\d{2}(\/\d{2})?\b/;
const CARD_NUMBER_RE = /#\s?([A-Z]{0,4}-?\d+)/;
const PRINT_RUN_RE = /\b(\d{1,4})\s*\/\s*(\d{1,4})\b/;

export interface ParsedVisionResult {
  attributes: CardAttributes;
  confidence: CardAttributesConfidence;
  /** Raw OCR text, kept for debugging/manual-correction pre-fill context. */
  rawText: string;
}

/**
 * Parses raw Vision annotations into CardAttributes + per-field confidence.
 * Always probabilistic — the caller (POST /api/recognize/vision) never
 * persists this result directly. Async because manufacturer/product/team/
 * player/sport/parallel/auto/rookie extraction is now a Claude call
 * (see claudeParseVisionText.ts) rather than a synchronous keyword match —
 * callers must await this.
 */
export async function parseVisionResult(raw: VisionRawResult): Promise<ParsedVisionResult> {
  const text = raw.fullText ?? raw.textAnnotations.map((t) => t.description).join('\n');

  // Cheap, deterministic pattern extraction — kept as the primary source for
  // these three fields specifically (see module comment above).
  const yearMatch = text.match(YEAR_RE);
  const cardNumberMatch = text.match(CARD_NUMBER_RE);
  const printRunMatch = text.match(PRINT_RUN_RE);

  const { attributes: claudeAttrs, confidence: claudeConfidence } = await parseCardTextWithClaude(text);

  const confidence: CardAttributesConfidence = { ...claudeConfidence };

  const year = yearMatch ? yearMatch[0] : claudeAttrs.year ?? '';
  confidence.year = yearMatch ? 0.6 : claudeConfidence.year ?? 0.1;

  const cardNumber = cardNumberMatch ? `#${cardNumberMatch[1]}` : claudeAttrs.card_number ?? '';
  confidence.card_number = cardNumberMatch ? 0.65 : claudeConfidence.card_number ?? 0.1;

  const printRun = printRunMatch ? Number(printRunMatch[2]) : claudeAttrs.print_run ?? null;
  confidence.print_run = printRunMatch ? 0.6 : claudeConfidence.print_run ?? 0.1;

  // sport falls back to a low-confidence default (never left undefined) so
  // downstream form state always has a valid Sport value — Review must
  // confirm regardless, per confidence.sport staying low in that case.
  const attributes: CardAttributes = {
    sport: claudeAttrs.sport ?? 'NFL',
    league: claudeAttrs.league ?? null,
    player: claudeAttrs.player ?? '',
    team: claudeAttrs.team ?? '',
    year,
    manufacturer: claudeAttrs.manufacturer ?? '',
    product: claudeAttrs.product ?? '',
    card_number: cardNumber,
    parallel_name: claudeAttrs.parallel_name ?? null,
    print_run: printRun,
    is_auto: claudeAttrs.is_auto ?? false,
    is_rookie: claudeAttrs.is_rookie ?? false,
    condition: 'Excellent', // neutral default — self-assessed, always confirmed in Review
    grade: null,
    grader: null,
  };
  confidence.condition = 0.1; // pure placeholder, always requires human confirmation

  return { attributes, confidence, rawText: text };
}
