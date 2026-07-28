"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Card } from "@/hooks/useCards";

const STATUS_LABEL: Record<Card["status"], string> = {
  "in-stock": "In Stock",
  listed: "Listed",
  sold: "Sold",
};

function fmtMoney(v: string | null): string {
  if (v == null) return "—";
  const n = Number(v);
  return `$${n.toFixed(2)}`;
}

function cardTitle(card: Card): string {
  return `${card.year} ${card.manufacturer} ${card.product} — ${card.player}`;
}

interface CardCollectionListProps {
  cards: Card[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
}

/** Grid on mobile, real <table> from md: up — per design-spec.md. Both
 * views share the same selection state for BulkActionsBar. */
export function CardCollectionList({ cards, selected, onToggleSelect }: CardCollectionListProps) {
  return (
    <>
      {/* Mobile grid */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
        {cards.map((card) => (
          <li key={card.id} className="rounded-xl border border-border bg-paper p-4">
            <div className="flex items-start justify-between gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(card.id)}
                  onChange={() => onToggleSelect(card.id)}
                  aria-label={`Select ${cardTitle(card)}`}
                  className="h-5 w-5 rounded border-border"
                />
              </label>
              <Badge tone={card.status === "sold" ? "slate" : card.status === "listed" ? "gold" : "neutral"}>
                {STATUS_LABEL[card.status]}
              </Badge>
            </div>
            <Link href={`/collection/${card.id}`} className="mt-2 block">
              <p className="font-medium text-ink">{cardTitle(card)}</p>
              <p className="text-xs text-ink-70">
                {card.team} · #{card.card_number}
                {card.parallel_name ? ` · ${card.parallel_name}` : ""}
              </p>
              <p className="mt-2 font-mono text-sm text-ink">{fmtMoney(card.estimated_value)}</p>
              <span className="text-xs font-medium text-gold-dark">View details →</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-50">
              <th className="w-10 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="py-2 pr-3">Card</th>
              <th className="py-2 pr-3">Sport</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Est. Value</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id} className="border-b border-border last:border-0 hover:bg-bone-100">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(card.id)}
                    onChange={() => onToggleSelect(card.id)}
                    aria-label={`Select ${cardTitle(card)}`}
                    className="h-5 w-5 rounded border-border"
                  />
                </td>
                <td className="py-2 pr-3">
                  <p className="font-medium text-ink">{cardTitle(card)}</p>
                  <p className="text-xs text-ink-70">
                    {card.team} · #{card.card_number}
                    {card.parallel_name ? ` · ${card.parallel_name}` : ""}
                  </p>
                </td>
                <td className="py-2 pr-3 text-ink-70">{card.sport}</td>
                <td className="py-2 pr-3">
                  <Badge tone={card.status === "sold" ? "slate" : card.status === "listed" ? "gold" : "neutral"}>
                    {STATUS_LABEL[card.status]}
                  </Badge>
                </td>
                <td className="py-2 pr-3 font-mono">{fmtMoney(card.estimated_value)}</td>
                <td className="py-2 text-right">
                  <Link href={`/collection/${card.id}`} className="text-sm font-medium text-gold-dark">
                    View details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
