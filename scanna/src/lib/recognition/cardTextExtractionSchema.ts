// zod schema for the Claude OCR-text-extraction contract (see
// claudeParseVisionText.ts). Mirrors the pattern in
// lib/estimate/valueEstimateSchema.ts: a zod schema (server-side validation,
// defense in depth) plus a matching JSON schema passed to Anthropic's
// `output_config.format` for generation-time constraint. Do not trust the
// model's output shape by contract alone — the zod parse below is what's
// actually relied on.
//
// Every attribute is nullable — Claude is instructed (see the system prompt
// in claudeParseVisionText.ts) to return null rather than guess when it
// can't confidently read a field from noisy OCR text.

import { z } from 'zod';

const confidenceLevel = z.enum(['high', 'medium', 'low']);

export const cardTextExtractionSchema = z.object({
  attributes: z.object({
    sport: z.enum(['NFL', 'NBA', 'UFC', 'Soccer']).nullable(),
    league: z.string().nullable(),
    player: z.string().nullable(),
    team: z.string().nullable(),
    year: z.string().nullable(),
    manufacturer: z.string().nullable(),
    product: z.string().nullable(),
    card_number: z.string().nullable(),
    parallel_name: z.string().nullable(),
    print_run: z.number().nullable(),
    is_auto: z.boolean().nullable(),
    is_rookie: z.boolean().nullable(),
  }),
  confidence: z.object({
    sport: confidenceLevel,
    league: confidenceLevel,
    player: confidenceLevel,
    team: confidenceLevel,
    year: confidenceLevel,
    manufacturer: confidenceLevel,
    product: confidenceLevel,
    card_number: confidenceLevel,
    parallel_name: confidenceLevel,
    print_run: confidenceLevel,
    is_auto: confidenceLevel,
    is_rookie: confidenceLevel,
  }),
});

export type CardTextExtractionParsed = z.infer<typeof cardTextExtractionSchema>;

// JSON Schema mirror of the above, passed to Anthropic's
// `output_config.format` (native structured outputs).
export const cardTextExtractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    attributes: {
      type: 'object',
      additionalProperties: false,
      properties: {
        // Anthropic's structured-output schema validator rejects a nullable
        // enum expressed as `type: ['string','null'], enum: [...]` — a
        // nullable enum needs `anyOf` instead (confirmed against a real
        // 400: "Enum value 'NFL' does not match declared type
        // '['string', 'null']'"). The plain nullable fields below (no enum)
        // aren't affected by this — only enum + nullable together triggers it.
        sport: {
          anyOf: [
            { type: 'string', enum: ['NFL', 'NBA', 'UFC', 'Soccer'] },
            { type: 'null' },
          ],
        },
        league: { type: ['string', 'null'] },
        player: { type: ['string', 'null'] },
        team: { type: ['string', 'null'] },
        year: { type: ['string', 'null'] },
        manufacturer: { type: ['string', 'null'] },
        product: { type: ['string', 'null'] },
        card_number: { type: ['string', 'null'] },
        parallel_name: { type: ['string', 'null'] },
        print_run: { type: ['number', 'null'] },
        is_auto: { type: ['boolean', 'null'] },
        is_rookie: { type: ['boolean', 'null'] },
      },
      required: [
        'sport', 'league', 'player', 'team', 'year', 'manufacturer', 'product',
        'card_number', 'parallel_name', 'print_run', 'is_auto', 'is_rookie',
      ],
    },
    confidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sport: { type: 'string', enum: ['high', 'medium', 'low'] },
        league: { type: 'string', enum: ['high', 'medium', 'low'] },
        player: { type: 'string', enum: ['high', 'medium', 'low'] },
        team: { type: 'string', enum: ['high', 'medium', 'low'] },
        year: { type: 'string', enum: ['high', 'medium', 'low'] },
        manufacturer: { type: 'string', enum: ['high', 'medium', 'low'] },
        product: { type: 'string', enum: ['high', 'medium', 'low'] },
        card_number: { type: 'string', enum: ['high', 'medium', 'low'] },
        parallel_name: { type: 'string', enum: ['high', 'medium', 'low'] },
        print_run: { type: 'string', enum: ['high', 'medium', 'low'] },
        is_auto: { type: 'string', enum: ['high', 'medium', 'low'] },
        is_rookie: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: [
        'sport', 'league', 'player', 'team', 'year', 'manufacturer', 'product',
        'card_number', 'parallel_name', 'print_run', 'is_auto', 'is_rookie',
      ],
    },
  },
  required: ['attributes', 'confidence'],
} as const;
