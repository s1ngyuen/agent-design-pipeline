"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { useCard, reEstimateCard } from "@/hooks/useCards";
import { useEbayListings } from "@/hooks/useEbayListings";
import { useSales } from "@/hooks/useSales";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ValueEstimateBreakdown } from "@/components/card-detail/ValueEstimateBreakdown";
import { ListingHistoryTable } from "@/components/card-detail/ListingHistoryTable";
import { MarkSoldForm } from "@/components/card-detail/MarkSoldForm";
import { EditCardForm } from "@/components/card-detail/EditCardForm";
import { CreateDraftListingButton } from "@/components/card-detail/CreateDraftListingButton";
import { DraftListingPanel } from "@/components/card-detail/DraftListingPanel";
import { PublishListingButton } from "@/components/card-detail/PublishListingButton";
import { projectedNetProceeds } from "@/lib/ebayFeeEstimate";

const STATUS_LABEL: Record<string, string> = { "in-stock": "In Stock", listed: "Listed", sold: "Sold" };

export function CardDetailPageClient({ id }: { id: string }) {
  const { showToast } = useToast();
  const { card, isLoading, mutate } = useCard(id);
  const { listings, mutate: mutateListings } = useEbayListings();
  const { sales } = useSales();
  const [reEstimating, setReEstimating] = useState(false);

  if (isLoading) return <p className="text-sm text-ink-50">Loading…</p>;
  if (!card) return notFound();

  const cardListings = listings.filter((l) => l.card_id === card.id);
  const draft = cardListings.find((l) => l.status === "draft");
  const activeOrPast = cardListings.filter((l) => l.status !== "draft");
  const cardSale = sales.find((s) => s.card_id === card.id);

  async function handleRefreshEstimate() {
    setReEstimating(true);
    try {
      const updated = await reEstimateCard(card!.id, card!.version);
      mutate(updated, { revalidate: false });
    } catch {
      showToast("Couldn't complete the research this time. Your last estimate is still shown below — try again in a bit.", "error");
    } finally {
      setReEstimating(false);
    }
  }

  const metaLine = [
    card.team,
    `#${card.card_number}`,
    card.parallel_name,
    card.print_run ? `/${card.print_run}` : null,
    card.condition,
    card.grade && card.grader ? `${card.grader} ${card.grade}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-8">
      {/* Always a row with the Edit button pinned top-right, at every
       * breakpoint — previously this switched from a stacked column
       * (Edit button below, left-aligned) on mobile to a row (Edit button
       * top-right) at sm: and up, so the button's position shifted between
       * layouts. Keeping it a row throughout (the heading text just wraps
       * within its own flex-1 column) keeps the button in the same visual
       * corner everywhere. */}
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {card.year} {card.manufacturer} {card.product} — {card.player}
          </h1>
          <p className="mt-1 text-sm text-ink-70">{metaLine}</p>
          <Badge className="mt-2" tone={card.status === "sold" ? "slate" : card.status === "listed" ? "gold" : "neutral"}>
            {STATUS_LABEL[card.status]}
          </Badge>
        </div>
        <div className="shrink-0">
          <EditCardForm card={card} onSaved={(updated) => mutate(updated, { revalidate: false })} />
        </div>
      </div>

      {card.notes !== undefined && (
        <section>
          <h2 className="font-heading text-lg font-semibold text-ink">Notes</h2>
          <p className="mt-1 text-sm text-ink-70">
            {card.notes || "No notes yet. Add anything worth remembering about this card."}
          </p>
        </section>
      )}

      {card.value_estimate_detail ? (
        <section className="rounded-xl border border-border bg-paper p-4">
          <ValueEstimateBreakdown estimate={card.value_estimate_detail} />
          <Button className="mt-4" variant="secondary" onClick={handleRefreshEstimate} loading={reEstimating}>
            Refresh Estimate
          </Button>
          <p className="mt-1 text-xs text-ink-50">Runs the research again — useful if it&apos;s been a while or the market&apos;s moved.</p>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-paper p-4 text-sm text-ink-70">No value estimate yet for this card.</section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-ink">eBay Listing</h2>

        {draft ? (
          <>
            <DraftListingPanel listing={draft} onUpdated={() => mutateListings()} />
            <PublishListingButton
              listing={draft}
              onPublished={() => {
                mutateListings();
                mutate();
              }}
            />
          </>
        ) : activeOrPast.some((l) => l.status === "active") ? (
          <div className="rounded-lg border border-gold-dark/30 bg-gold-soft p-4 text-sm text-ink">
            <p className="font-semibold">Live on eBay</p>
            <p className="mt-1">Your listing is now public. Buyers can find and bid on or buy this card starting now.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-paper p-4">
            <p className="font-semibold text-ink">Not listed on eBay yet</p>
            <p className="mt-1 text-sm text-ink-70">When you&apos;re ready to sell, create a draft first. Nothing goes live until you explicitly publish it.</p>
            {card.estimated_value && (
              <div className="mt-3 rounded-lg bg-bone-100 p-3 text-sm text-ink-70">
                <p className="font-semibold text-ink">Before you list</p>
                <p className="mt-1">
                  At today&apos;s estimate (${Number(card.estimated_value).toFixed(2)}), after eBay&apos;s
                  typical final value fee, you&apos;d net roughly $
                  {projectedNetProceeds(Number(card.estimated_value)).toFixed(2)}. This is a projection based on
                  the current estimate, not a guarantee of sale price.
                </p>
              </div>
            )}
            <div className="mt-4">
              <CreateDraftListingButton card={card} onCreated={() => mutateListings()} />
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold text-ink">Listing History</h2>
        <div className="mt-2">
          <ListingHistoryTable listings={cardListings} />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold text-ink">Sales</h2>
        <div className="mt-2">
          {cardSale ? (
            <div className="rounded-lg border border-border bg-paper p-4 text-sm">
              <p className="font-medium text-ink">Sold for ${Number(cardSale.sale_price).toFixed(2)} on {cardSale.sale_date}</p>
              <p className="mt-1 text-ink-70">Net profit: ${Number(cardSale.net_profit).toFixed(2)} · {cardSale.platform}</p>
            </div>
          ) : (
            <MarkSoldForm card={card} onSold={() => { mutate(); }} />
          )}
        </div>
      </section>
    </div>
  );
}
