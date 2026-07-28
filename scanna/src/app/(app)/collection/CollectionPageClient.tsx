"use client";

import { useState } from "react";
import Link from "next/link";
import { useCards, type CardFilters } from "@/hooks/useCards";
import { FilterBar } from "@/components/collection/FilterBar";
import { ExportButton } from "@/components/collection/ExportButton";
import { CardCollectionList } from "@/components/collection/CardCollectionList";
import { BulkActionsBar } from "@/components/collection/BulkActionsBar";
import { Button } from "@/components/ui/Button";

export function CollectionPageClient() {
  const [filters, setFilters] = useState<CardFilters>({});
  const { cards, isLoading, mutate } = useCards(filters);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const hasFilters = !!(filters.q || filters.sport || filters.status);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleBulkDone() {
    clearSelection();
    mutate();
  }

  const selectedCards = cards.filter((c) => selected.has(c.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Your Collection</h1>
          <p className="text-sm text-ink-70">Every card you&apos;ve added, with its current status and latest estimated value.</p>
        </div>
        <ExportButton filters={filters} />
      </div>

      <FilterBar onChange={setFilters} />

      {isLoading ? (
        <p className="text-sm text-ink-50">Loading…</p>
      ) : cards.length === 0 ? (
        hasFilters ? (
          <div className="rounded-xl border border-border bg-paper p-8 text-center">
            <p className="text-sm text-ink-70">No cards match these filters. Try widening your search or clearing a filter.</p>
            <Button className="mt-4" variant="secondary" onClick={() => setFilters({})}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-paper p-8 text-center">
            <p className="font-heading text-lg font-semibold text-ink">Your Collection is empty</p>
            <p className="mt-1 text-sm text-ink-70">Scan your first card, or add one manually, to start building your inventory.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/scan">
                <Button variant="accent">Scan a Card</Button>
              </Link>
              <Link href="/scan?manual=1">
                <Button variant="secondary">Enter Manually</Button>
              </Link>
            </div>
          </div>
        )
      ) : (
        <CardCollectionList cards={cards} selected={selected} onToggleSelect={toggleSelect} />
      )}

      <BulkActionsBar selectedCards={selectedCards} onClear={clearSelection} onDone={handleBulkDone} />
    </div>
  );
}
