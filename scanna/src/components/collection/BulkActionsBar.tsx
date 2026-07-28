"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { deleteCard } from "@/hooks/useCards";
import { createSale } from "@/hooks/useSales";
import { validatePrice } from "@/lib/validation/cardForm";
import type { Card } from "@/hooks/useCards";

interface BulkActionsBarProps {
  selectedCards: Card[];
  onClear: () => void;
  onDone: () => void;
}

export function BulkActionsBar({ selectedCards, onClear, onDone }: BulkActionsBarProps) {
  const { showToast } = useToast();
  const deleteTitleId = useId();
  const soldTitleId = useId();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
  const [working, setWorking] = useState(false);

  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState<"eBay" | "other">("eBay");
  const [fees, setFees] = useState("");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");
  const [priceError, setPriceError] = useState<string | undefined>();

  const n = selectedCards.length;
  if (n === 0) return null;

  async function handleBulkDelete() {
    setWorking(true);
    try {
      await Promise.all(selectedCards.map((c) => deleteCard(c.id)));
      showToast("Saved.", "success");
      setConfirmingDelete(false);
      onDone();
    } catch {
      showToast("Something didn't save — try again.", "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleBulkMarkSold() {
    const err = validatePrice(salePrice);
    if (err) {
      setPriceError(err);
      return;
    }
    setPriceError(undefined);
    setWorking(true);
    try {
      await Promise.all(
        selectedCards.map((c) =>
          createSale({
            card_id: c.id,
            sale_price: Number(salePrice),
            sale_date: saleDate,
            platform,
            fees: fees.trim() ? Number(fees) : null,
            shipping_cost: shipping.trim() ? Number(shipping) : null,
            buyer_notes: notes.trim() || null,
            expectedVersion: c.version,
          }),
        ),
      );
      showToast(`Marked sold.`, "success");
      setMarkingSold(false);
      onDone();
    } catch {
      showToast("Something didn't save — try again.", "error");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <div className="sticky bottom-16 z-20 flex items-center justify-between gap-3 rounded-lg border border-border bg-ink px-4 py-3 text-bone shadow-lg lg:bottom-4">
        <span className="text-sm font-medium">{n} selected</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="accent" onClick={() => setMarkingSold(true)}>
            Mark Sold
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" className="text-bone hover:bg-bone/10" onClick={onClear}>
            Clear selection
          </Button>
        </div>
      </div>

      <Dialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)} titleId={deleteTitleId}>
        <h2 id={deleteTitleId} className="font-heading text-lg font-semibold text-ink">
          Delete {n} card{n === 1 ? "" : "s"}?
        </h2>
        <p className="mt-2 text-sm text-ink-70">
          This removes all {n} from your Collection permanently, including their estimates and listing
          history. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleBulkDelete} loading={working}>
            Delete {n} card{n === 1 ? "" : "s"}
          </Button>
        </div>
      </Dialog>

      <Dialog open={markingSold} onClose={() => setMarkingSold(false)} titleId={soldTitleId}>
        <h2 id={soldTitleId} className="font-heading text-lg font-semibold text-ink">
          Mark {n} card{n === 1 ? "" : "s"} sold
        </h2>
        <p className="mt-2 text-sm text-ink-70">These sale details apply to all {n} selected cards.</p>
        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Sale price"
            placeholder="$0.00"
            inputMode="decimal"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            error={priceError}
          />
          <TextField label="Sale date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          <SelectField
            label="Platform"
            options={[
              { value: "eBay", label: "eBay" },
              { value: "other", label: "Other" },
            ]}
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "eBay" | "other")}
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
          <Button variant="secondary" onClick={() => setMarkingSold(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleBulkMarkSold} loading={working}>
            Mark Sold
          </Button>
        </div>
      </Dialog>
    </>
  );
}
