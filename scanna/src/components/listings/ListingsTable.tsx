import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { EbayListing } from "@/hooks/useEbayListings";

const STATUS_LABEL: Record<EbayListing["status"], string> = {
  draft: "Draft",
  active: "Active",
  sold: "Sold",
  "ended-unsold": "Ended — Unsold",
};

export function ListingsTable({ listings }: { listings: EbayListing[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-50">
            <th className="py-2 pr-3">Card</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Price</th>
            <th className="py-2 pr-3">Views</th>
            <th className="py-2 pr-3">Watchers</th>
            <th className="py-2 pr-3">Listed</th>
            <th className="py-2 pr-3">Last Synced</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">{l.card_player ?? l.title}</td>
              <td className="py-2 pr-3">
                <Badge tone={l.status === "active" ? "gold" : l.status === "sold" ? "slate" : "neutral"}>{STATUS_LABEL[l.status]}</Badge>
              </td>
              <td className="py-2 pr-3 font-mono">{l.buy_now_price ? `$${Number(l.buy_now_price).toFixed(2)}` : "—"}</td>
              <td className="py-2 pr-3">{l.views ?? "—"}</td>
              <td className="py-2 pr-3">{l.watchers ?? "—"}</td>
              <td className="py-2 pr-3">{l.listed_date ?? "—"}</td>
              <td className="py-2 pr-3">{l.last_synced ? new Date(l.last_synced).toLocaleString() : "—"}</td>
              <td className="py-2">
                <Link href={`/collection/${l.card_id}`} className="text-sm font-medium text-gold-dark">
                  View Card
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
