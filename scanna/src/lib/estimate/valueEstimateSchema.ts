// zod schema for the ValueEstimate contract (plan.md §6, revised). This is
// the single source of truth for validating Claude's final structured
// answer server-side — never trust the model's output shape without this.

import { z } from 'zod';

export const valueEstimateSchema = z.object({
  range: z.object({
    low: z.number(),
    mid: z.number(),
    high: z.number(),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  reference_breakdown: z.array(
    z.object({
      type: z.enum(['direct_comp', 'reference_player']),
      label: z.string(),
      source: z.string(),
      // The actual URL for this reference (eBay sold listing, 130point.com,
      // PSA APR, etc.), sourced from Claude's web_search/web_fetch results —
      // null if it genuinely can't attribute one. Lets the frontend link out
      // to what Claude actually found rather than just a text label.
      url: z.string().url().nullable(),
      price: z.number().nullable(),
      sale_date: z.string().nullable(), // "YYYY-MM-DD" | null
      weight: z.number().min(0).max(1),
      note: z.string(),
    }),
  ),
  divergence_flag: z.object({
    flagged: z.boolean(),
    reason: z.string().nullable(),
  }),
  caveats: z.array(z.string()),
});

export type ValueEstimateParsed = z.infer<typeof valueEstimateSchema>;

// JSON Schema mirror of the above, passed to Anthropic's
// `output_config.format` (native structured outputs) so Claude's final
// response is constrained at generation time — zod validation below is
// still run server-side as defense in depth (never trust a model's output
// shape purely because a schema was requested).
export const valueEstimateJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    range: {
      type: 'object',
      additionalProperties: false,
      properties: {
        low: { type: 'number' },
        mid: { type: 'number' },
        high: { type: 'number' },
      },
      required: ['low', 'mid', 'high'],
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reference_breakdown: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['direct_comp', 'reference_player'] },
          label: { type: 'string' },
          source: { type: 'string' },
          url: { type: ['string', 'null'] },
          price: { type: ['number', 'null'] },
          sale_date: { type: ['string', 'null'] },
          weight: { type: 'number', minimum: 0, maximum: 1 },
          note: { type: 'string' },
        },
        required: ['type', 'label', 'source', 'url', 'price', 'sale_date', 'weight', 'note'],
      },
    },
    divergence_flag: {
      type: 'object',
      additionalProperties: false,
      properties: {
        flagged: { type: 'boolean' },
        reason: { type: ['string', 'null'] },
      },
      required: ['flagged', 'reason'],
    },
    caveats: { type: 'array', items: { type: 'string' } },
  },
  required: ['range', 'confidence', 'reference_breakdown', 'divergence_flag', 'caveats'],
} as const;
