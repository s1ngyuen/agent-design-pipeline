"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { validatePrice } from "@/lib/validation/cardForm";
import { convertLookupToCard } from "@/hooks/useLookups";
import { ApiError } from "@/lib/api";

/** content.md "Add to Inventory (the bridge action)". */
export function AddToInventoryButton({
  lookupId,
  onConverted,
  disabled,
}: {
  lookupId: string;
  onConverted?: () => void;
  disabled?: boolean;
}) {
  const { showToast } = useToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("0.00");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    const err = validatePrice(price);
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    try {
      await convertLookupToCard(lookupId, Number(price), date);
      showToast("Added to your Collection.", "success");
      setOpen(false);
      onConverted?.();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        Add to Inventory
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} titleId={titleId}>
        <h2 id={titleId} className="font-heading text-lg font-semibold text-ink">
          Add to your Collection
        </h2>
        <p className="mt-1 text-sm text-ink-70">
          This turns your lookup into a real inventory item. Just need what you actually paid.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Acquisition price"
            placeholder="$0.00"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint="Enter $0 if it was a pack pull or already owned."
            error={error}
          />
          <TextField label="Acquisition date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Not yet
          </Button>
          <Button type="button" variant="accent" onClick={handleConfirm} loading={submitting}>
            Add to Collection
          </Button>
        </div>
      </Dialog>
    </>
  );
}
