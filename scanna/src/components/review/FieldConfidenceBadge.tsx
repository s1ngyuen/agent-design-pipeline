import { Badge } from "@/components/ui/Badge";

export type FieldConfidenceKind = "high" | "check" | "cert";

/** Per-field confidence indicator — content.md "Field Confidence Badges".
 * Neutral labels, no color-as-verdict beyond a mild gold nudge on "check
 * this" (never red — nothing here is an error, just worth a glance). */
export function FieldConfidenceBadge({ kind }: { kind: FieldConfidenceKind }) {
  if (kind === "cert") return <Badge tone="slate">From cert record</Badge>;
  if (kind === "high") return <Badge tone="neutral">High confidence</Badge>;
  return <Badge tone="gold">Check this</Badge>;
}

export function confidenceToKind(confidence: number | undefined): FieldConfidenceKind {
  if (confidence === undefined) return "check";
  return confidence >= 0.7 ? "high" : "check";
}
