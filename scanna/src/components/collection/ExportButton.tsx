"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { CardFilters } from "@/hooks/useCards";

export function ExportButton({ filters }: { filters: CardFilters }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.sport) params.set("sport", filters.sport);
      if (filters.q) params.set("q", filters.q);
      const res = await fetch(`/api/cards/export?${params.toString()}`);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scanna-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Your CSV is downloading.", "success");
    } catch {
      showToast("Couldn't build the export — try again in a moment.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="secondary" onClick={handleExport} loading={loading}>
        Export CSV
      </Button>
      <p className="mt-1 text-xs text-ink-50">Downloads the cards matching your current filters — handy for taxes or backups.</p>
    </div>
  );
}
