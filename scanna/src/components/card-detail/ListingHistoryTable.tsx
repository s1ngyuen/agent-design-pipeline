import { Badge } from "@/components/ui/Badge";
import type { EbayListing } from "@/hooks/useEbayListings";

const STATUS_LABEL: Record<EbayListing["status"], string> = {
  draft: "Draft",
  active: "Active",
  sold: "Sold",
  "ended-unsold": "Ended — Unsold",
};

export function ListingHistoryTable({ listings }: { listings: EbayListing[] }) {
  if (listings.length === 0) {
    return <p className="text-sm text-ink-70">No listings yet for this card.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-50">
            <th className="py-2 pr-3">Title</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Price</th>
            <th className="py-2 pr-3">Listed</th>
            <th className="py-2">Last Synced</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">{l.title}</td>
              <td className="py-2 pr-3">
                <Badge tone={l.status === "active" ? "gold" : l.status === "sold" ? "slate" : "neutral"}>
                  {STATUS_LABEL[l.status]}
                </Badge>
              </td>
              <td className="py-2 pr-3 font-mono">{l.buy_now_price ? `$${Number(l.buy_now_price).toFixed(2)}` : "—"}</td>
              <td className="py-2 pr-3">{l.listed_date ?? "—"}</td>
              <td className="py-2">{l.last_synced ? new Date(l.last_synced).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
