"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import type { CardFilters } from "@/hooks/useCards";

const SPORTS = ["All Sports", "NFL", "NBA", "UFC", "Soccer"];
const STATUSES: { label: string; value: string }[] = [
  { label: "All Statuses", value: "" },
  { label: "In Stock", value: "in-stock" },
  { label: "Listed", value: "listed" },
  { label: "Sold", value: "sold" },
];

export function FilterBar({ onChange }: { onChange: (filters: CardFilters) => void }) {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState("");

  // Debounced text search (~300ms — technical-defaults' borrowed
  // debounce technique from search-batch-add, per plan.md §1a).
  useEffect(() => {
    const t = setTimeout(() => {
      onChange({ q: q || undefined, sport: sport || undefined, status: status || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sport, status]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-50" />
        <input
          type="search"
          aria-label="Search by player, set, or card number"
          placeholder="Search by player, set, or card #"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-border bg-paper py-2 pl-9 pr-3 text-base text-ink placeholder:text-ink-50 focus-visible:outline-2 focus-visible:outline-gold"
        />
      </div>
      <select
        aria-label="Filter by sport"
        value={sport}
        onChange={(e) => setSport(e.target.value === "All Sports" ? "" : e.target.value)}
        className="min-h-[44px] rounded-lg border border-border bg-paper px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-gold"
      >
        {SPORTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="min-h-[44px] rounded-lg border border-border bg-paper px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-gold"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
