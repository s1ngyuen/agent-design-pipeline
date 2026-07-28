// Claude-based interpretation of raw Google Vision OCR text — replaces the
// old hardcoded keyword/regex heuristic for the fields that heuristic could
// never reliably cover (manufacturer, product, team, player, sport, etc.).
// See parseVisionResult.ts for why: a fixed keyword list can never cover
// every manufacturer/product/team that exists, but Claude's language
// understanding (including its training knowledge of real trading-card
// manufacturers/products/team names) can make sense of noisy, jumbled
// text-detection output the way a human would.
//
// This is deliberately a single, lightweight, non-agentic call — unlike
// estimateCardValue() in lib/estimate/claudeEstimate.ts, there is no
// web_search/web_fetch tool loop here. This is pure text-in,
// structured-JSON-out extraction, so it should stay well under 5 seconds.

import Anthropic from '@anthropic-ai/sdk';
import {
  cardTextExtractionSchema,
  cardTextExtractionJsonSchema,
  type CardTextExtractionParsed,
} from './cardTextExtractionSchema';
import type { CardAttributes, CardAttributesConfidence } from '@/domain/types';

// Instantiated once at module scope, mirroring the singleton pattern in
// lib/estimate/claudeEstimate.ts — never recreate the client per request.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// Same default model as the rest of the app (lib/estimate/claudeEstimate.ts,
// per plan.md/brief.md's stated default). This call is small/cheap
// regardless of model since there's no tool-use loop, so there's no reason
// to reach for a cheaper model here.
const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1_500;

const SYSTEM_PROMPT = `You are a trading-card OCR interpretation assistant.

You will be given raw, noisy text-detection output from Google Cloud Vision's OCR on a photo of a single sports/trading card. This text is NOT clean layout — it is a jumble of every text fragment Vision detected on the card, in a detection-driven order that may not match the card's visual reading order. Lines may be split, merged, mis-cased, or contain OCR errors (e.g. "0" for "O", "1" for "I").

Your job: extract whatever card attributes you can confidently determine from this text, using your own knowledge of real trading-card manufacturers (e.g. Topps, Panini, Donruss, Upper Deck, Bowman, Leaf), products/sets (e.g. Chrome, Prizm, Select, Optic, Mosaic, Contenders, National Treasures), sports leagues, and team names to make sense of noisy or abbreviated text — the same way a knowledgeable human collector would read a messy OCR dump.

HARD RULE: never guess or fabricate a value just to fill a field. If you cannot confidently determine a field from the text (even using your general knowledge to interpret noisy fragments), return null for it. A null is far more useful than a wrong guess — every field here is shown to a human for confirmation before anything is saved, but a wrong high-confidence-looking value can mislead that review.

For each field, also return a confidence level:
- "high": the text is clear and you're confident in the value
- "medium": you inferred the value from partial/noisy/abbreviated text, or from general knowledge filling a gap
- "low": you're returning your best guess but it's genuinely uncertain (still fill the value if you have one — reserve null for "no reasonable basis at all")

Fields to extract:
- sport: one of NFL, NBA, UFC, Soccer — infer from team names, league markers, or sport-specific terminology if present
- league: e.g. "NFL", "Premier League" — often the same signal as sport, null if not determinable
- player: the athlete's full name
- team: the team/club name
- year: the card's year (or season, e.g. "2023" or "2023/24"), as printed
- manufacturer: e.g. Topps, Panini, Donruss, Upper Deck, Bowman, Leaf
- product: the specific product/set line, e.g. Chrome, Prizm, Select, Optic, Mosaic, Contenders, National Treasures, Stadium Club
- card_number: the card number as printed, typically prefixed with "#" (e.g. "#123", "#RC-4")
- parallel_name: a parallel/insert variant name if one is printed (e.g. "Silver Prizm", "Gold Refractor"), null for a base card or if not determinable
- print_run: the numbered print run denominator if the card is serial-numbered (e.g. "12/99" -> 99), null if not numbered or not determinable
- is_auto: true if the text indicates this is an autographed card (e.g. "AUTOGRAPH", "AUTO", a certificate-of-authenticity marking), false if there's clear evidence it's not, null if you can't tell either way
- is_rookie: true if the text indicates a rookie card (e.g. "ROOKIE", "RC"), false if there's clear evidence it's not, null if you can't tell either way

Return ONLY the structured JSON answer described by the response schema — no extra commentary outside that schema.`;

export class ClaudeParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ClaudeParseError';
  }
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function tryParseJson(text: string): unknown | null {
  // Defensive: strip a ```json fence if Claude wraps the answer in one
  // despite being asked not to, same as claudeEstimate.ts.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return null;
  }
}

const CONFIDENCE_SCORE: Record<CardTextExtractionParsed['confidence']['sport'], number> = {
  high: 0.85,
  medium: 0.55,
  low: 0.25,
};

/**
 * Maps a single extracted field to a CardAttributes value + numeric
 * confidence, per the existing CardAttributesConfidence contract (0-1).
 * A null/undetermined value always collapses confidence toward 0 regardless
 * of what Claude reported, since there's nothing for Review to trust either way.
 */
function scoreField<T>(value: T | null, level: CardTextExtractionParsed['confidence'][keyof CardTextExtractionParsed['confidence']]): { value: T | null; confidence: number } {
  if (value === null) return { value: null, confidence: 0.1 };
  return { value, confidence: CONFIDENCE_SCORE[level] };
}

export interface ClaudeParsedCardText {
  attributes: Partial<CardAttributes>;
  confidence: CardAttributesConfidence;
}

/**
 * Sends raw Vision OCR text to Claude for a single, non-agentic structured
 * extraction pass. Returns partial CardAttributes (fields Claude couldn't
 * determine are simply absent/empty) plus a per-field confidence map.
 *
 * Deliberately no retry loop beyond one schema-validation nudge — this call
 * has no tool use, so a bad response is either a transient API issue (let
 * the caller decide how to handle failure) or a genuine parse miss.
 */
export async function parseCardTextWithClaude(rawOcrText: string): Promise<ClaudeParsedCardText> {
  const client = getClient();
  const model = process.env.ANTHROPIC_PARSE_MODEL || DEFAULT_MODEL;

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: `Raw OCR text detected on the card:\n\n${rawOcrText}` },
  ];

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
      output_config: {
        format: {
          type: 'json_schema',
          schema: cardTextExtractionJsonSchema,
        },
      },
    });
  } catch (err) {
    throw new ClaudeParseError('Claude text-parsing request failed', err);
  }

  if (response.stop_reason === 'refusal') {
    throw new ClaudeParseError('Claude refused to parse this card text');
  }

  const text = extractText(response.content);
  let candidate = tryParseJson(text);
  let parsed = candidate ? cardTextExtractionSchema.safeParse(candidate) : null;

  if (!parsed?.success) {
    // One nudge — ask Claude to correct against the schema, matching
    // claudeEstimate.ts's approach, but without an open-ended retry loop
    // since this call has no tool use to make progress on.
    try {
      const retryResponse = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          ...messages,
          { role: 'assistant', content: response.content },
          {
            role: 'user',
            content: parsed
              ? `Your last response did not match the required schema: ${parsed.error.message}. Return ONLY the corrected JSON object, nothing else.`
              : 'I could not parse a JSON object from your last response. Return ONLY that JSON object, nothing else.',
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: cardTextExtractionJsonSchema,
          },
        },
      });
      const retryText = extractText(retryResponse.content);
      candidate = tryParseJson(retryText);
      parsed = candidate ? cardTextExtractionSchema.safeParse(candidate) : null;
    } catch (err) {
      throw new ClaudeParseError('Claude text-parsing retry request failed', err);
    }
  }

  if (!parsed?.success) {
    throw new ClaudeParseError('Claude did not return a valid structured card-text extraction');
  }

  const { attributes: a, confidence: c } = parsed.data;

  const sport = scoreField(a.sport, c.sport);
  const league = scoreField(a.league, c.league);
  const player = scoreField(a.player, c.player);
  const team = scoreField(a.team, c.team);
  const year = scoreField(a.year, c.year);
  const manufacturer = scoreField(a.manufacturer, c.manufacturer);
  const product = scoreField(a.product, c.product);
  const cardNumber = scoreField(a.card_number, c.card_number);
  const parallelName = scoreField(a.parallel_name, c.parallel_name);
  const printRun = scoreField(a.print_run, c.print_run);
  const isAuto = scoreField(a.is_auto, c.is_auto);
  const isRookie = scoreField(a.is_rookie, c.is_rookie);

  const attributes: Partial<CardAttributes> = {};
  if (sport.value !== null) attributes.sport = sport.value;
  if (league.value !== null) attributes.league = league.value;
  if (player.value !== null) attributes.player = player.value;
  if (team.value !== null) attributes.team = team.value;
  if (year.value !== null) attributes.year = year.value;
  if (manufacturer.value !== null) attributes.manufacturer = manufacturer.value;
  if (product.value !== null) attributes.product = product.value;
  if (cardNumber.value !== null) attributes.card_number = cardNumber.value;
  if (parallelName.value !== null) attributes.parallel_name = parallelName.value;
  if (printRun.value !== null) attributes.print_run = printRun.value;
  if (isAuto.value !== null) attributes.is_auto = isAuto.value;
  if (isRookie.value !== null) attributes.is_rookie = isRookie.value;

  const confidence: CardAttributesConfidence = {
    sport: sport.confidence,
    league: league.confidence,
    player: player.confidence,
    team: team.confidence,
    year: year.confidence,
    manufacturer: manufacturer.confidence,
    product: product.confidence,
    card_number: cardNumber.confidence,
    parallel_name: parallelName.confidence,
    print_run: printRun.confidence,
    is_auto: isAuto.confidence,
    is_rookie: isRookie.confidence,
  };

  return { attributes, confidence };
}
