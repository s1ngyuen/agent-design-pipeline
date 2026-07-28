// Anthropic Claude call — the value-estimation reasoning layer, per
// plan.md §6 "Claude API — Value-Estimation Request/Response Contract"
// (revised). Claude sources its own comps live via the Anthropic-hosted
// `web_search` (type `web_search_20260209`) and `web_fetch`
// (type `web_fetch_20260209`) SERVER tools — these are executed by
// Anthropic's own infrastructure, not by this app, and their results are
// appended into the same conversation automatically. This is genuinely an
// agentic, multi-step research call, not a single-shot completion: Claude
// may search multiple times, fetch specific listing pages, and only then
// produce its final structured answer.
//
// The single most important instruction in the system prompt: an active
// "Buy It Now"/asking-price listing is NEVER a comp — only a confirmed
// completed sale counts. This is carried over verbatim from the
// card-ladder project's own domain method.
//
// Structured output is enforced two ways: (1) Anthropic's native
// `output_config.format` (JSON-schema-constrained generation) and (2) a
// zod validation pass on the parsed result before it's ever returned to a
// caller — never trust a model's output shape by contract alone.

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { CardAttributes } from '@/domain/types';
import { valueEstimateSchema, valueEstimateJsonSchema, type ValueEstimateParsed } from './valueEstimateSchema';

// Instantiated once at module scope, like the DB client — never recreate
// per request.
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

// Brief's stated default — reasoning quality matters more than per-scan
// cost at "near-free" volume. Revisit claude-sonnet-5 only if per-scan cost
// becomes a real constraint at higher volume (see plan.md §6).
const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_TOOL_LOOP_ITERATIONS = 8;
const MAX_TOKENS = 8_000;

const SYSTEM_PROMPT = `You are a sports/trading-card value-estimation assistant for a card-reselling business tool.

Your job: given a single card's attributes, research its current market value using live web search and return a structured estimate.

HARD RULE — read this twice, it is the single most important instruction in this prompt:
An active "Buy It Now" listing, a current asking price, or any listing that has not sold is NEVER a comp. Only a CONFIRMED COMPLETED SALE counts as evidence of value. If you find an active listing, you may note its asking price in a caveat for context, but it must never be counted as a comp or folded into the range calculation. Mislabeling an active listing as a sale is the single worst failure mode for this tool — treat it as a hard constraint, not a preference.

Research method:
1. Search for completed/sold listings for the EXACT card (same player, set, parallel, print run, grade if slabbed) across eBay sold listings, 130point.com, and PSA's Auction Prices Realized (APR) tool. Use web_search to find candidates and web_fetch to read a specific listing/page in full when you need to confirm sale price, sale date, and sold-vs-active status.
2. If direct comps are thin or absent (expected for low-print-run parallels or recent releases), search for 3-5 reference players in the same set/product at a similar rarity/print-run tier and use their sold prices to triangulate a value for the target card via cross-player/tier-curve reasoning. Mark these as "reference_player" entries, not "direct_comp".
3. Only after gathering evidence, produce your final structured answer. Every reference_breakdown entry must cite what you found: a label describing the item, the source you found it on, the ACTUAL URL of the specific listing/page you found it at (from your web_search/web_fetch results — e.g. the eBay sold-listing URL, the 130point.com listing page, the PSA APR entry page), the price (or null if you're citing an active listing purely for caveat context — in which case sale_date must also be null), the sale date if known, a weight (0-1) reflecting how much it influenced your final range, and a note. Only set url to null if you genuinely cannot attribute a specific page (e.g. you are citing a general market trend rather than one listing) — never fabricate or guess a URL, and never invent a plausible-looking one just to fill the field.
4. If web search turns up thin or no usable data, say so honestly in caveats rather than guessing — do not fabricate comps or prices.
5. Set divergence_flag.flagged = true (with a reason) when your direct comps and reference-player triangulation meaningfully disagree, or when you have very few data points and the range is more speculative than usual.

Return ONLY the structured JSON answer described by the response schema — no extra commentary outside that schema.`;

function buildUserPrompt(card: CardAttributes): string {
  const lines = [
    `Estimate the current market value of this card:`,
    ``,
    `Sport: ${card.sport}`,
    card.league ? `League: ${card.league}` : null,
    `Player: ${card.player}`,
    `Team: ${card.team}`,
    `Year: ${card.year}`,
    `Manufacturer: ${card.manufacturer}`,
    `Product: ${card.product}`,
    `Card number: ${card.card_number}`,
    card.parallel_name ? `Parallel: ${card.parallel_name}` : `Parallel: base (none)`,
    card.print_run != null ? `Print run: /${card.print_run}` : `Print run: not numbered / unknown`,
    `Autograph: ${card.is_auto ? 'yes' : 'no'}`,
    `Rookie card: ${card.is_rookie ? 'yes' : 'no'}`,
    `Condition (self-assessed): ${card.condition}`,
    card.grade != null ? `Professional grade: ${card.grade} (${card.grader ?? 'unknown grader'})` : `Ungraded (raw)`,
  ].filter((l): l is string => l !== null);
  return lines.join('\n');
}

export class ClaudeEstimateError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ClaudeEstimateError';
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
  // Claude is instructed to return only JSON, but strip code fences
  // defensively in case it wraps the answer in a ```json block anyway.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return null;
  }
}

/**
 * Runs the agentic Claude value-estimation call: web_search/web_fetch are
 * server tools executed by Anthropic itself, so most of the "loop" happens
 * inside a single API response. We still loop manually to handle
 * `pause_turn` (long-running tool-use turns Anthropic asks us to resume)
 * and the rare case where Claude's final answer doesn't parse/validate on
 * the first attempt, up to MAX_TOOL_LOOP_ITERATIONS.
 */
export async function estimateCardValue(card: CardAttributes): Promise<ValueEstimateParsed> {
  const client = getClient();
  const model = process.env.ANTHROPIC_ESTIMATE_MODEL || DEFAULT_MODEL;

  const messages: MessageParam[] = [
    { role: 'user', content: buildUserPrompt(card) },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++) {
    let response: Anthropic.Messages.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
        tools: [
          {
            type: 'web_search_20260209',
            name: 'web_search',
            max_uses: 8,
          },
          {
            type: 'web_fetch_20260209',
            name: 'web_fetch',
            max_uses: 8,
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: valueEstimateJsonSchema,
          },
        },
      });
    } catch (err) {
      throw new ClaudeEstimateError('Anthropic API request failed', err);
    }

    if (response.stop_reason === 'pause_turn') {
      // Long-running tool-use turn — resume by feeding the assistant's
      // partial content straight back per Anthropic's pause_turn contract.
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    if (response.stop_reason === 'refusal') {
      throw new ClaudeEstimateError('Claude refused to produce a value estimate for this card');
    }

    const text = extractText(response.content);
    const candidate = tryParseJson(text);

    if (candidate) {
      const parsed = valueEstimateSchema.safeParse(candidate);
      if (parsed.success) {
        return parsed.data;
      }
      // Ask Claude to correct its answer against the schema rather than
      // silently failing or fabricating a fallback.
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: `Your last response did not match the required schema: ${parsed.error.message}. Return ONLY the corrected JSON object, nothing else.`,
      });
      continue;
    }

    if (response.stop_reason === 'max_tokens') {
      // Ran out of room mid-answer — retry with an explicit nudge to wrap up.
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: 'You ran out of tokens before finishing. Wrap up your research now and return ONLY the final JSON object.',
      });
      continue;
    }

    // end_turn but no parseable JSON — nudge once more before giving up.
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: 'I could not parse a JSON object matching the required schema from your last response. Return ONLY that JSON object, nothing else.',
    });
  }

  throw new ClaudeEstimateError(
    `Claude did not produce a valid value estimate within ${MAX_TOOL_LOOP_ITERATIONS} iterations`,
  );
}
