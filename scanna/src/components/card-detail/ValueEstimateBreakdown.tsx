import { Badge } from "@/components/ui/Badge";
import type { ValueEstimate, EstimateConfidence } from "@/domain/types";

// reference_breakdown[].url now carries the fully-qualified URL Claude
// actually found the comp at (eBay sold listing, 130point.com, PSA APR,
// etc.) — see src/domain/types.ts's ReferenceBreakdownEntry. Null means
// Claude couldn't attribute one specific page (e.g. citing an aggregate
// trend rather than a single sale), in which case we fall back to the
// plain-text source label instead of fabricating a link target.
const CONFIDENCE_LABEL: Record<EstimateConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function fmt(n: number | null): string {
  return n == null ? "—" : `$${n.toFixed(2)}`;
}

/**
 * Renders the full Claude value-estimation contract — content.md "Value
 * Estimate Breakdown" — used on Card Detail and inline on Research's result
 * card (same component, different container, per plan.md §3).
 */
export function ValueEstimateBreakdown({ estimate }: { estimate: ValueEstimate }) {
  const { range, confidence, reference_breakdown, divergence_flag, caveats } = estimate;
  const span = Math.max(range.high - range.low, 0.01);
  const midPct = Math.min(100, Math.max(0, ((range.mid - range.low) / span) * 100));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-ink">Value Estimate</h2>
          {/* Neutral tone at every level, deliberately — "low confidence"
           * means less certain data, not that something went wrong, and a
           * red/danger badge here would read as an alarm. The label text
           * carries the meaning, not the color (same reasoning as the
           * brief's no-red/green rule for the buy-signal badge). */}
          <Badge tone="slate">{CONFIDENCE_LABEL[confidence]}</Badge>
        </div>
        <p className="mt-2 text-sm text-ink-70">
          This is a researched estimate, not a guarantee — Claude searched recent sold listings and reasoned
          over what it found. Check the sources below before relying on it for a big decision.
        </p>
      </div>

      {confidence === "low" && (
        <p className="rounded-lg bg-bone-100 px-4 py-3 text-sm text-ink-70">
          Not much to go on for this one. Take this estimate as a rough starting point, not a firm number.
        </p>
      )}

      <div>
        <p className="text-sm font-medium text-ink-70">Estimated range</p>
        <div className="mt-2">
          <div className="relative h-2 rounded-full bg-bone-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${midPct}%` }} />
            <div
              className="absolute -top-1 h-4 w-1 rounded-full bg-gold"
              style={{ left: `calc(${midPct}% - 2px)` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-sm text-ink-70">
            <span>{fmt(range.low)}</span>
            <span className="font-semibold text-ink">Most likely: {fmt(range.mid)}</span>
            <span>{fmt(range.high)}</span>
          </div>
        </div>
      </div>

      {divergence_flag.flagged && (
        <div role="alert" className="rounded-lg border border-plum bg-plum-soft px-4 py-3 text-sm text-ink">
          <p className="font-semibold">Heads up — two estimation approaches disagreed here</p>
          <p className="mt-1">{divergence_flag.reason}</p>
          <p className="mt-1">
            We&apos;ve shown you the range anyway, but treat it as a wider guess than usual until more comps
            turn up.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-ink">What this is based on</h3>
        {/* Table at sm: and above */}
        <div className="mt-2 hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-50">
                <th className="py-2 pr-3">Comp</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Sale Price</th>
                <th className="py-2 pr-3">Sale Date</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {reference_breakdown.map((ref, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 align-top">{ref.label}</td>
                  <td className="py-2 pr-3 align-top">
                    <Badge tone="neutral">{ref.type === "direct_comp" ? "Direct comp" : "Reference player"}</Badge>
                  </td>
                  <td className="py-2 pr-3 align-top font-mono">{fmt(ref.price)}</td>
                  <td className="py-2 pr-3 align-top font-mono">
                    {ref.sale_date ?? <span className="text-ink-50">Excluded — active listing, not a completed sale</span>}
                  </td>
                  <td className="py-2 align-top">
                    {ref.url ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink underline decoration-ink-50 underline-offset-2 hover:text-plum focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                      >
                        View listing <span aria-hidden="true">→</span>
                        <span className="sr-only"> ({ref.source})</span>
                      </a>
                    ) : (
                      <span className="text-ink-70">{ref.source}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Card-per-reference below 640px, per design-spec.md mobile note */}
        <ul className="mt-2 flex flex-col gap-2 sm:hidden">
          {reference_breakdown.map((ref, i) => (
            <li key={i} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{ref.label}</span>
                <Badge tone="neutral">{ref.type === "direct_comp" ? "Direct comp" : "Reference player"}</Badge>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-70">
                <dt>Sale Price</dt>
                <dd className="font-mono text-ink">{fmt(ref.price)}</dd>
                <dt>Sale Date</dt>
                <dd className="font-mono">
                  {ref.sale_date ?? "Excluded — active listing, not a completed sale"}
                </dd>
                <dt>Source</dt>
                <dd>
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-ink underline decoration-ink-50 underline-offset-2 hover:text-plum focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                    >
                      View listing <span aria-hidden="true">→</span>
                      <span className="sr-only"> ({ref.source})</span>
                    </a>
                  ) : (
                    ref.source
                  )}
                </dd>
              </dl>
              {ref.note && <p className="mt-2 text-xs text-ink-50">{ref.note}</p>}
            </li>
          ))}
        </ul>
      </div>

      {caveats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink">Worth knowing</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-70">
            {caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

