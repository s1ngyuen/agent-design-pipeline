import type { CardAttributes } from "@/domain/types";

/** Compact read-only summary shown above the correction form — content.md
 * Review Page H1/subheading. */
export function IdentifiedCardSummary({
  attributes,
  source,
}: {
  attributes: Partial<CardAttributes>;
  source: "auto-id" | "cert" | "manual" | "search";
}) {
  const title = [attributes.year, attributes.manufacturer, attributes.product].filter(Boolean).join(" ");
  const subtitle = [attributes.player, attributes.card_number && `#${attributes.card_number.replace(/^#/, "")}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border border-border bg-paper p-4">
      <h1 className="font-heading text-2xl font-semibold text-ink">Confirm this card</h1>
      <p className="mt-1 text-sm text-ink-70">
        {source === "cert"
          ? "Matched from the cert number. This comes straight from the grading company's record, but give it a quick look before saving."
          : source === "search"
            ? "Matched from our checklist database — real card data. Just fill in condition/grade below."
            : source === "manual"
              ? "Enter the card's details below."
              : "Here's what we read. Check each field — anything we're not sure about is flagged."}
      </p>
      {(title || subtitle) && (
        <div className="mt-4 rounded-lg bg-bone-100 px-4 py-3">
          {title && <p className="font-mono text-sm text-ink-70">{title}</p>}
          {subtitle && <p className="font-heading text-lg font-semibold text-ink">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
