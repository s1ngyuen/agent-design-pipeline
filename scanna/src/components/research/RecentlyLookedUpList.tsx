"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/time";
import { AddToInventoryButton } from "./AddToInventoryButton";
import type { Lookup } from "@/hooks/useLookups";

export function RecentlyLookedUpList({ lookups, onConverted }: { lookups: Lookup[]; onConverted: () => void }) {
  const [visible, setVisible] = useState(10);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold text-ink">Recently looked up</h2>

      {lookups.length === 0 ? (
        <p className="rounded-lg border border-border bg-paper p-4 text-sm text-ink-70">
          Nothing here yet. Scan or enter a card above to check its value — it&apos;ll show up in this list.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {lookups.slice(0, visible).map((lookup) => {
              const range = lookup.value_estimate_detail?.range;
              return (
                <li
                  key={lookup.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-paper p-3"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {lookup.year} {lookup.manufacturer} {lookup.product} — {lookup.player}
                    </p>
                    <p className="text-xs text-ink-70">
                      Looked up {timeAgo(lookup.looked_up_at)}
                      {range ? ` · Est. $${range.low}–$${range.high}` : ""}
                    </p>
                  </div>
                  {lookup.converted_card_id ? (
                    <span className="text-xs font-medium text-ink-50">Added</span>
                  ) : (
                    <AddToInventoryButton lookupId={lookup.id} onConverted={onConverted} />
                  )}
                </li>
              );
            })}
          </ul>
          {visible < lookups.length && (
            <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + 10)}>
              Load more
            </Button>
          )}
        </>
      )}
    </section>
  );
}
