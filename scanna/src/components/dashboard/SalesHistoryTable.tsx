import type { Sale } from "@/hooks/useSales";

export function SalesHistoryTable({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-paper p-6 text-center">
        <p className="font-heading text-base font-semibold text-ink">No sales yet</p>
        <p className="mt-1 text-sm text-ink-70">Once you mark a card sold, it&apos;ll show up here with profit calculated automatically.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-50">
            <th className="py-2 pr-3">Card</th>
            <th className="py-2 pr-3">Sale Price</th>
            <th className="py-2 pr-3">Fees</th>
            <th className="py-2 pr-3">Shipping</th>
            <th className="py-2 pr-3">Net Profit</th>
            <th className="py-2 pr-3">Date</th>
            <th className="py-2">Platform</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">{s.card_player}</td>
              <td className="py-2 pr-3 font-mono">${Number(s.sale_price).toFixed(2)}</td>
              <td className="py-2 pr-3 font-mono">{s.fees ? `$${Number(s.fees).toFixed(2)}` : "—"}</td>
              <td className="py-2 pr-3 font-mono">{s.shipping_cost ? `$${Number(s.shipping_cost).toFixed(2)}` : "—"}</td>
              <td className="py-2 pr-3 font-mono font-semibold">${Number(s.net_profit).toFixed(2)}</td>
              <td className="py-2 pr-3">{s.sale_date}</td>
              <td className="py-2">{s.platform}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
