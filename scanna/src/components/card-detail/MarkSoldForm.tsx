"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { validatePrice } from "@/lib/validation/cardForm";
import { createSale } from "@/hooks/useSales";
import { ApiError } from "@/lib/api";
import type { Card } from "@/hooks/useCards";
import type { SalePlatform } from "@/domain/types";

export function MarkSoldForm({ card, onSold }: { card: Card; onSold: () => void }) {
  const { showToast } = useToast();
  const formTitleId = useId();
  const confirmTitleId = useId();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState<SalePlatform>("eBay");
  const [fees, setFees] = useState("");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");
  const [priceError, setPriceError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function openForm() {
    setOpen(true);
  }

  function requestConfirm() {
    const err = validatePrice(price);
    if (err) {
      setPriceError(err);
      return;
    }
    setPriceError(undefined);
    setConfirming(true);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const sale = await createSale({
        card_id: card.id,
        sale_price: Number(price),
        sale_date: date,
        platform,
        fees: fees.trim() ? Number(fees) : null,
        shipping_cost: shipping.trim() ? Number(shipping) : null,
        buyer_notes: notes.trim() || null,
        expectedVersion: card.version,
      });
      showToast(`Marked sold. Net profit: $${Number(sale.net_profit).toFixed(2)}.`, "success");
      setConfirming(false);
      setOpen(false);
      onSold();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (card.status === "sold") return null;

  return (
    <>
      <Button type="button" variant="secondary" onClick={openForm}>
        Mark as Sold
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} titleId={formTitleId}>
        <h2 id={formTitleId} className="font-heading text-lg font-semibold text-ink">
          Mark as Sold
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Sale price"
            placeholder="$0.00"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={priceError}
          />
          <TextField label="Sale date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectField
            label="Platform"
            options={[
              { value: "eBay", label: "eBay" },
              { value: "other", label: "Other" },
            ]}
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SalePlatform)}
          />
          <TextField
            label="Fees"
            placeholder="$0.00"
            inputMode="decimal"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            hint="Leave blank if you're not sure yet — you can edit this later."
          />
          <TextField label="Shipping cost" placeholder="$0.00" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} />
          <TextAreaField
            label="Buyer notes"
            placeholder="Optional — anything worth remembering about this sale."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={requestConfirm}>
            Mark Sold
          </Button>
        </div>
      </Dialog>

      <Dialog open={confirming} onClose={() => setConfirming(false)} titleId={confirmTitleId}>
        <h2 id={confirmTitleId} className="font-heading text-lg font-semibold text-ink">
          Mark this card sold?
        </h2>
        <p className="mt-2 text-sm text-ink-70">
          It&apos;ll move out of your active inventory and into your sales history. You can still edit the
          details afterward.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleConfirm} loading={submitting}>
            Mark Sold
          </Button>
        </div>
      </Dialog>
    </>
  );
}
