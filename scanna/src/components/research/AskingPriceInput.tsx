"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { validatePrice } from "@/lib/validation/cardForm";
import { BuySignalPanel } from "./BuySignalBadge";
import type { BuySignal } from "@/domain/types";

interface AskingPriceInputProps {
  askingPrice: number | null;
  buySignal: BuySignal | null;
  onCheck: (price: number) => Promise<void>;
  checking?: boolean;
}

/** content.md "Asking Price section" + "Buy Signal" — always shows the
 * framing line, and the empty state until a price has been entered. */
export function AskingPriceInput({ askingPrice, buySignal, onCheck, checking }: AskingPriceInputProps) {
  const [value, setValue] = useState(askingPrice != null ? String(askingPrice) : "");
  const [error, setError] = useState<string | undefined>();

  async function handleCheck() {
    const err = validatePrice(value);
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    await onCheck(Number(value));
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-paper p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">What&apos;s it going for?</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Seller's asking price"
            placeholder="$0.00"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            hint="Enter what's on the tag or what the seller quoted you — we'll weigh it against the estimate."
            error={error}
          />
        </div>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={handleCheck} loading={checking}>
          Check the price
        </Button>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-ink">How does this asking price compare?</h3>
        <p className="mt-1 text-sm text-ink-70">
          This compares the asking price to what we found — not advice on whether to buy. You know the card,
          the seller, and the moment better than we do.
        </p>
        <div className="mt-3">
          {buySignal ? (
            <BuySignalPanel signal={buySignal} />
          ) : (
            <p className="text-sm text-ink-50">Add the asking price above if you want to see how it compares to the estimate.</p>
          )}
        </div>
      </div>
    </div>
  );
}
