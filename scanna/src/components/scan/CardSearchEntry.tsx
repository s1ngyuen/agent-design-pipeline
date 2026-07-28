"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/Field";
import { useChecklistSearch } from "@/hooks/useChecklistSearch";
import { checklistResultToCardAttributes, shortProductName, type ChecklistCardResult } from "@/lib/checklist";
import type { CardAttributes } from "@/domain/types";

/** Search-and-pick entry point for the scan flow's "Search" tab — an
 * alternative to Auto-ID/Cert Barcode/manual typing for when the exact card
 * is already known and sitting in our checklist database (real per-card
 * reference data — see schema.ts's checklist_cards comment). Picking a
 * result pre-fills the Review form's identity fields the same way Auto-ID
 * does, just from a confirmed real card instead of a camera guess. */
export function CardSearchEntry({
  onSelect,
}: {
  onSelect: (attributes: Partial<CardAttributes>) => void;
}) {
  const [query, setQuery] = useState("");
  const { results, status } = useChecklistSearch(query);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <TextField
        label="Search for a card"
        placeholder="Player, set, or card number..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        hint="e.g. &ldquo;Marvin Harrison Chrome&rdquo; or &ldquo;2025 Topps Finest&rdquo;"
      />

      {status === "loading" && <p className="text-sm text-ink-70">Searching...</p>}

      {status === "error" && (
        <p className="text-sm text-ink-70">Couldn&apos;t search right now — check your connection and try again.</p>
      )}

      {status === "ready" && results.length === 0 && (
        <p className="text-sm text-ink-70">
          No matches in our checklist database. You can still enter this card manually.
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((r) => (
            <ChecklistResultRow key={r.id} result={r} onSelect={() => onSelect(checklistResultToCardAttributes(r))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChecklistResultRow({ result, onSelect }: { result: ChecklistCardResult; onSelect: () => void }) {
  const isBaseSubset = result.subset.toLowerCase() === "base";
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="min-h-[44px] w-full rounded-lg border border-border bg-paper px-4 py-3 text-left transition-colors hover:bg-bone-100 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1"
      >
        <p className="font-mono text-xs text-ink-70">
          {result.year} {result.manufacturer} {shortProductName(result)}
          {!isBaseSubset && ` ${result.subset}`}
        </p>
        <p className="font-heading text-base font-semibold text-ink">
          {result.player}
          {result.card_number && <span className="ml-1.5 text-ink-70">#{result.card_number.replace(/^#/, "")}</span>}
        </p>
        <p className="text-sm text-ink-70">
          {[result.team, result.is_rookie && "Rookie", result.is_auto && "Auto"].filter(Boolean).join(" · ")}
        </p>
      </button>
    </li>
  );
}
