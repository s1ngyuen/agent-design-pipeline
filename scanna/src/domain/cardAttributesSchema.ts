// Shared zod schema for CardAttributes (src/domain/types.ts) — the shape
// common to recognition output, /api/estimate's request body, and the
// card-shape fields on both `cards` and `lookups`. Kept here so every route
// that accepts card-shape input validates identically.

import { z } from 'zod';

export const sportSchema = z.enum(['NFL', 'NBA', 'UFC', 'Soccer']);
export const conditionSchema = z.enum(['Mint', 'Excellent', 'Good', 'Poor']);
export const graderSchema = z.enum(['PSA', 'BGS', 'SGC', 'None']);

export const cardAttributesSchema = z.object({
  sport: sportSchema,
  league: z.string().nullable().optional().default(null),
  player: z.string().min(1),
  team: z.string().min(1),
  year: z.string().min(1),
  manufacturer: z.string().min(1),
  product: z.string().min(1),
  card_number: z.string().min(1),
  parallel_name: z.string().nullable().optional().default(null),
  print_run: z.number().int().positive().nullable().optional().default(null),
  is_auto: z.boolean(),
  is_rookie: z.boolean(),
  condition: conditionSchema,
  grade: z.number().nullable().optional().default(null),
  grader: graderSchema.nullable().optional().default(null),
});

export type CardAttributesInput = z.infer<typeof cardAttributesSchema>;
