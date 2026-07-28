import { Badge } from "@/components/ui/Badge";
import { BelowEstimateGlyph, InLineEstimateGlyph, AboveEstimateGlyph } from "@/components/ui/icons";
import type { BuySignal } from "@/domain/types";

// Non-financial-signal framing (brief.md/plan.md/content.md requirement):
// gold/slate/plum + a distinct glyph shape per state, never red/green,
// never a bare colour swatch. Labels describe the comparison, not a
// directive — content.md's own "Assumptions Made" note #1.
const CONFIG: Record<BuySignal, { label: string; tone: "gold" | "slate" | "plum"; Icon: typeof BelowEstimateGlyph; micro: string }> = {
  "good-buy": {
    label: "Below estimate",
    tone: "gold",
    Icon: BelowEstimateGlyph,
    micro: "The ask is under what recent sales suggest this card is worth. Worth a closer look if you want it.",
  },
  fair: {
    label: "In line with estimate",
    tone: "slate",
    Icon: InLineEstimateGlyph,
    micro: "The ask lands inside the researched range — a reasonable price either way.",
  },
  "walk-away": {
    label: "Above estimate",
    tone: "plum",
    Icon: AboveEstimateGlyph,
    micro: "The ask is higher than recent sales support. Your call whether the card's worth it to you anyway.",
  },
};

export function BuySignalBadge({ signal }: { signal: BuySignal }) {
  const { label, tone, Icon } = CONFIG[signal];
  return (
    <Badge tone={tone} icon={<Icon className="h-3.5 w-3.5" />}>
      {label}
    </Badge>
  );
}

export function BuySignalPanel({ signal }: { signal: BuySignal }) {
  const { micro } = CONFIG[signal];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <BuySignalBadge signal={signal} />
      </div>
      <p className="text-sm text-ink-70">{micro}</p>
    </div>
  );
}
