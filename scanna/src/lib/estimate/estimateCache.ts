// Read/write helpers for value_estimate_cache (see schema.ts's comment on
// that table for why it exists and why it deliberately has no DB-level
// unique constraint). Matches on exact card identity + condition/grade —
// everything estimateCardValue() actually considers.

import { and, desc, eq, isNull, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { getDb, schema } from '@/db';
import type { CardAttributes, ValueEstimate } from '@/domain/types';

function eqOrNull(column: AnyPgColumn, value: string | number | boolean | null): SQL {
  return value === null ? isNull(column) : eq(column, value);
}

export interface CachedEstimate {
  estimate: ValueEstimate;
  cachedAt: string; // ISO timestamp
}

export async function lookupCachedEstimate(card: CardAttributes): Promise<CachedEstimate | null> {
  const db = getDb();
  const t = schema.valueEstimateCache;

  const [row] = await db
    .select({ estimate_detail: t.estimate_detail, created_at: t.created_at })
    .from(t)
    .where(
      and(
        eq(t.sport, card.sport),
        eqOrNull(t.league, card.league),
        eq(t.player, card.player),
        eq(t.team, card.team),
        eq(t.year, card.year),
        eq(t.manufacturer, card.manufacturer),
        eq(t.product, card.product),
        eq(t.card_number, card.card_number),
        eqOrNull(t.parallel_name, card.parallel_name),
        eqOrNull(t.print_run, card.print_run),
        eq(t.is_auto, card.is_auto),
        eq(t.is_rookie, card.is_rookie),
        eq(t.condition, card.condition),
        eqOrNull(t.grade, card.grade != null ? String(card.grade) : null),
        eqOrNull(t.grader, card.grader),
      ),
    )
    .orderBy(desc(t.created_at))
    .limit(1);

  if (!row) return null;
  return { estimate: row.estimate_detail as ValueEstimate, cachedAt: row.created_at.toISOString() };
}

export async function saveEstimateToCache(card: CardAttributes, estimate: ValueEstimate): Promise<void> {
  await getDb()
    .insert(schema.valueEstimateCache)
    .values({
      sport: card.sport,
      league: card.league,
      player: card.player,
      team: card.team,
      year: card.year,
      manufacturer: card.manufacturer,
      product: card.product,
      card_number: card.card_number,
      parallel_name: card.parallel_name,
      print_run: card.print_run,
      is_auto: card.is_auto,
      is_rookie: card.is_rookie,
      condition: card.condition,
      grade: card.grade != null ? String(card.grade) : null,
      grader: card.grader,
      estimate_detail: estimate,
    });
}
