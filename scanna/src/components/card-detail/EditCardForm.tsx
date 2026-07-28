"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, ToggleField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { patchCard, ApiError, type Card } from "@/hooks/useCards";
import {
  validateRequired,
  validateYear,
  validatePrintRun,
  validateGradeGrader,
  validatePrice,
} from "@/lib/validation/cardForm";
import type { Condition, Grader, Sport } from "@/domain/types";

const SPORT_OPTIONS = [
  { value: "NFL", label: "NFL" },
  { value: "NBA", label: "NBA" },
  { value: "UFC", label: "UFC" },
  { value: "Soccer", label: "Soccer" },
];
const CONDITION_OPTIONS = [
  { value: "Mint", label: "Mint" },
  { value: "Excellent", label: "Excellent" },
  { value: "Good", label: "Good" },
  { value: "Poor", label: "Poor" },
];
const GRADER_OPTIONS = [
  { value: "PSA", label: "PSA" },
  { value: "BGS", label: "BGS" },
  { value: "SGC", label: "SGC" },
  { value: "None", label: "None" },
];

export function EditCardForm({ card, onSaved }: { card: Card; onSaved: (updated: Card) => void }) {
  const { showToast } = useToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sport, setSport] = useState<Sport>(card.sport);
  const [player, setPlayer] = useState(card.player);
  const [team, setTeam] = useState(card.team);
  const [year, setYear] = useState(card.year);
  const [manufacturer, setManufacturer] = useState(card.manufacturer);
  const [product, setProduct] = useState(card.product);
  const [cardNumber, setCardNumber] = useState(card.card_number);
  const [parallel, setParallel] = useState(card.parallel_name ?? "");
  const [printRun, setPrintRun] = useState(card.print_run != null ? String(card.print_run) : "");
  const [isAuto, setIsAuto] = useState(card.is_auto);
  const [isRookie, setIsRookie] = useState(card.is_rookie);
  const [condition, setCondition] = useState<Condition>(card.condition);
  const [grade, setGrade] = useState(card.grade != null ? String(card.grade) : "");
  const [grader, setGrader] = useState<Grader | "">(card.grader ?? "");
  const [acqPrice, setAcqPrice] = useState(card.acquisition_price);
  const [acqDate, setAcqDate] = useState(card.acquisition_date);
  const [notes, setNotes] = useState(card.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    const req = (label: string, key: string, value: string) => {
      const err = validateRequired(label, value);
      if (err) next[key] = err;
    };
    req("Player", "player", player);
    req("Team", "team", team);
    req("Manufacturer", "manufacturer", manufacturer);
    req("Product / Set", "product", product);
    req("Card #", "card_number", cardNumber);
    const yearErr = validateYear(year);
    if (yearErr) next.year = yearErr;
    const printRunErr = validatePrintRun(printRun);
    if (printRunErr) next.print_run = printRunErr;
    const gradeErr = validateGradeGrader(grade, grader);
    if (gradeErr) next.grade = gradeErr;
    const priceErr = validatePrice(acqPrice);
    if (priceErr) next.acquisition_price = priceErr;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const updated = await patchCard(card.id, card.version, {
        sport,
        player: player.trim(),
        team: team.trim(),
        year: year.trim(),
        manufacturer: manufacturer.trim(),
        product: product.trim(),
        card_number: cardNumber.trim(),
        parallel_name: parallel.trim() || null,
        print_run: printRun.trim() || null,
        is_auto: isAuto,
        is_rookie: isRookie,
        condition,
        grade: grade.trim() ? Number(grade.trim()) : null,
        grader: grader || null,
        acquisition_price: Number(acqPrice),
        acquisition_date: acqDate,
        notes: notes.trim() || null,
      });
      showToast("Card updated.", "success");
      setOpen(false);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showToast("This card was edited somewhere else — refresh to see the latest before saving your changes.", "error");
      } else {
        showToast(err instanceof ApiError ? err.message : "Something didn't save — try again.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Edit Card
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} titleId={titleId} className="max-h-[85vh] overflow-y-auto">
        <h2 id={titleId} className="font-heading text-lg font-semibold text-ink">
          Edit Card
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <SelectField label="Sport" options={SPORT_OPTIONS} value={sport} onChange={(e) => setSport(e.target.value as Sport)} />
          <TextField label="Player" value={player} onChange={(e) => setPlayer(e.target.value)} error={errors.player} />
          <TextField label="Team" value={team} onChange={(e) => setTeam(e.target.value)} error={errors.team} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Year" value={year} onChange={(e) => setYear(e.target.value)} error={errors.year} />
            <TextField label="Card #" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} error={errors.card_number} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} error={errors.manufacturer} />
            <TextField label="Product / Set" value={product} onChange={(e) => setProduct(e.target.value)} error={errors.product} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Parallel (if any)" value={parallel} onChange={(e) => setParallel(e.target.value)} />
            <TextField label="Print run (if numbered)" value={printRun} onChange={(e) => setPrintRun(e.target.value)} error={errors.print_run} />
          </div>
          <ToggleField label="Autographed" checked={isAuto} onChange={setIsAuto} />
          <ToggleField label="Rookie card" checked={isRookie} onChange={setIsRookie} />
          <SelectField label="Condition" options={CONDITION_OPTIONS} value={condition} onChange={(e) => setCondition(e.target.value as Condition)} />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Graded by" options={GRADER_OPTIONS} placeholder="Not graded" value={grader} onChange={(e) => setGrader(e.target.value as Grader)} />
            {grader && grader !== "None" && (
              <TextField label="Professional grade" value={grade} onChange={(e) => setGrade(e.target.value)} error={errors.grade} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <TextField label="Acquisition price" value={acqPrice} onChange={(e) => setAcqPrice(e.target.value)} error={errors.acquisition_price} />
            <TextField label="Acquisition date" type="date" value={acqDate} onChange={(e) => setAcqDate(e.target.value)} />
          </div>
          <TextAreaField
            label="Notes"
            placeholder="e.g. bought at a show alongside 4 other rookies, seller was firm on price"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSubmit} loading={submitting}>
            Save Changes
          </Button>
        </div>
      </Dialog>
    </>
  );
}
