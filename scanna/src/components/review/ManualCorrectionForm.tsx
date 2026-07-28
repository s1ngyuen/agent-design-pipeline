"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { TextField, SelectField, ToggleField } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { Button } from "@/components/ui/Button";
import { FieldConfidenceBadge, confidenceToKind, type FieldConfidenceKind } from "./FieldConfidenceBadge";
import { useTcdbChecklist } from "@/hooks/useTcdbChecklist";
import {
  validateRequired,
  validateYear,
  validatePrintRun,
  validateGradeGrader,
  validatePrice,
} from "@/lib/validation/cardForm";
import type { CardAttributes, Condition, Grader, Sport } from "@/domain/types";

export interface CardFormState {
  sport: Sport;
  league: string;
  player: string;
  team: string;
  year: string;
  manufacturer: string;
  product: string;
  card_number: string;
  parallel_name: string;
  print_run: string;
  is_auto: boolean;
  is_rookie: boolean;
  condition: Condition;
  grade: string;
  grader: Grader | "";
}

export function defaultCardFormState(partial?: Partial<CardAttributes>): CardFormState {
  return {
    sport: partial?.sport ?? "NFL",
    league: partial?.league ?? "",
    player: partial?.player ?? "",
    team: partial?.team ?? "",
    year: partial?.year ?? "",
    manufacturer: partial?.manufacturer ?? "",
    product: partial?.product ?? "",
    card_number: partial?.card_number ?? "",
    parallel_name: partial?.parallel_name ?? "",
    print_run: partial?.print_run != null ? String(partial.print_run) : "",
    is_auto: partial?.is_auto ?? false,
    is_rookie: partial?.is_rookie ?? false,
    condition: partial?.condition ?? "Mint",
    grade: partial?.grade != null ? String(partial.grade) : "",
    grader: partial?.grader ?? "",
  };
}

function toCardAttributes(state: CardFormState): CardAttributes {
  return {
    sport: state.sport,
    league: state.league.trim() || null,
    player: state.player.trim(),
    team: state.team.trim(),
    year: state.year.trim(),
    manufacturer: state.manufacturer.trim(),
    product: state.product.trim(),
    card_number: state.card_number.trim(),
    parallel_name: state.parallel_name.trim() || null,
    print_run: state.print_run.trim() || null,
    is_auto: state.is_auto,
    is_rookie: state.is_rookie,
    condition: state.condition,
    grade: state.grade.trim() ? Number(state.grade.trim()) : null,
    grader: state.grader || null,
  };
}

type Source = "auto-id" | "cert" | "manual" | "search";

export interface AcquisitionInput {
  acquisition_price: number;
  acquisition_date: string;
}

interface ManualCorrectionFormProps {
  initial?: Partial<CardAttributes>;
  /** Re-seeds the acquisition fields when returning to this form with data
   * already entered (e.g. "Edit details" after a failed estimate) so a
   * retry never discards what the user already typed. */
  initialAcquisition?: AcquisitionInput;
  confidence?: Partial<Record<keyof CardAttributes, number>>;
  source: Source;
  /** Collection-bound saves need acquisition_price/acquisition_date too
   * (the backend requires them — see src/app/api/cards/route.ts) even
   * though content.md's "Manual Correction Form" field list only covers
   * card-identity fields; this appends the two acquisition fields to the
   * same form rather than a separate step, reusing the Research
   * "Add to Inventory" dialog's copy for those two fields. Omit for
   * Research Mode (POST /api/lookups never takes acquisition fields). */
  requireAcquisition?: boolean;
  onSubmit: (attrs: CardAttributes, acquisition?: AcquisitionInput) => void | Promise<void>;
  submitLabel: string;
  submitting?: boolean;
}

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

export function ManualCorrectionForm({
  initial,
  initialAcquisition,
  confidence,
  source,
  requireAcquisition,
  onSubmit,
  submitLabel,
  submitting,
}: ManualCorrectionFormProps) {
  const [state, setState] = useState<CardFormState>(() => defaultCardFormState(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof CardFormState, string>>>({});
  const [acqPrice, setAcqPrice] = useState(() =>
    initialAcquisition ? initialAcquisition.acquisition_price.toFixed(2) : "0.00",
  );
  const [acqDate, setAcqDate] = useState(() => initialAcquisition?.acquisition_date ?? new Date().toISOString().slice(0, 10));
  const [acqErrors, setAcqErrors] = useState<{ price?: string; date?: string }>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Scroll/focus the error summary into view whenever a submit attempt
  // leaves errors behind, so validation failures are never silently off
  // -screen (this form can run long, especially with acquisition fields
  // appended).
  useEffect(() => {
    if (Object.keys(errors).length > 0 || Object.keys(acqErrors).length > 0) {
      errorSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      errorSummaryRef.current?.focus();
    }
  }, [errors, acqErrors]);

  const isTcdbSport = state.sport === "NFL" || state.sport === "NBA";
  const checklist = useTcdbChecklist(isTcdbSport ? (state.sport as "NFL" | "NBA") : "NFL");

  const playerSuggestions = useMemo(() => {
    if (!isTcdbSport || checklist.status !== "ready" && checklist.status !== "offline-cache") return [];
    return checklist.search("player", state.player).map((e) => e.player);
  }, [isTcdbSport, checklist, state.player]);

  function badgeFor(field: keyof CardAttributes): FieldConfidenceKind {
    if (source === "cert") return "cert";
    if (source === "search") return "checklist";
    if (source === "manual") return "high"; // no badge noise on pure manual entry
    return confidenceToKind(confidence?.[field]);
  }

  function set<K extends keyof CardFormState>(key: K, value: CardFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof CardFormState, string>> = {};
    const req = (label: string, key: keyof CardFormState) => {
      const err = validateRequired(label, state[key] as string);
      if (err) next[key] = err;
    };
    req("Player", "player");
    req("Team", "team");
    req("Manufacturer", "manufacturer");
    req("Product / Set", "product");
    req("Card #", "card_number");

    const yearErr = validateYear(state.year);
    if (yearErr) next.year = yearErr;

    const printRunErr = validatePrintRun(state.print_run);
    if (printRunErr) next.print_run = printRunErr;

    const gradeGraderErr = validateGradeGrader(state.grade, state.grader);
    if (gradeGraderErr) next.grade = gradeGraderErr;

    setErrors(next);

    if (requireAcquisition) {
      const nextAcq: { price?: string; date?: string } = {};
      const priceErr = validatePrice(acqPrice);
      if (priceErr) nextAcq.price = priceErr;
      if (!acqDate.trim()) nextAcq.date = "Acquisition date is required.";
      setAcqErrors(nextAcq);
      return Object.keys(next).length === 0 && Object.keys(nextAcq).length === 0;
    }

    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (requireAcquisition) {
      await onSubmit(toCardAttributes(state), {
        acquisition_price: Number(acqPrice),
        acquisition_date: acqDate,
      });
    } else {
      await onSubmit(toCardAttributes(state));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <h2 className="font-heading text-lg font-semibold text-ink">Fix any details</h2>

      {(Object.keys(errors).length > 0 || Object.keys(acqErrors).length > 0) && (
        <div
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger focus:outline-none"
        >
          <p className="font-semibold">Check the highlighted fields below</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {[...Object.values(errors), ...Object.values(acqErrors)].map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <SelectField
            label="Sport"
            required
            options={SPORT_OPTIONS}
            value={state.sport}
            onChange={(e) => set("sport", e.target.value as Sport)}
          />
        </div>
        <div className="pb-2.5">
          <FieldConfidenceBadge kind={badgeFor("sport")} />
        </div>
      </div>

      {state.sport === "UFC" && (
        <div role="note" className="rounded-lg border border-gold-dark/30 bg-gold-soft px-4 py-3 text-sm text-ink">
          <p className="font-semibold">UFC isn&apos;t fully supported yet</p>
          <p className="mt-1">
            We don&apos;t have checklist data for UFC cards yet, so there&apos;s no dropdown to pick from. You
            can still save this card — just fill in the player, set, and card number by hand below, and
            we&apos;ll treat every field as free text.
          </p>
        </div>
      )}

      {state.sport === "Soccer" && (
        <TextField
          label="League"
          placeholder="e.g. FIFA World Cup, UEFA"
          value={state.league}
          onChange={(e) => set("league", e.target.value)}
        />
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1">
          {isTcdbSport ? (
            <Combobox
              label="Player"
              required
              value={state.player}
              onChange={(v) => set("player", v)}
              suggestions={playerSuggestions}
              error={errors.player}
            />
          ) : (
            <TextField
              label="Player"
              required
              value={state.player}
              onChange={(e) => set("player", e.target.value)}
              error={errors.player}
            />
          )}
          {isTcdbSport && checklist.status === "unavailable" && (
            <p className="mt-1 text-xs text-ink-50">
              No match in our NFL/NBA checklist — you can still type it in, it&apos;ll just be saved as free
              text.
            </p>
          )}
          {isTcdbSport && checklist.status === "offline-cache" && (
            <p className="mt-1 text-xs text-ink-50">Using your cached checklist (may be a few days old) since you&apos;re offline.</p>
          )}
        </div>
        <div className="pb-2.5">
          <FieldConfidenceBadge kind={badgeFor("player")} />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <TextField label="Team" required value={state.team} onChange={(e) => set("team", e.target.value)} error={errors.team} />
        </div>
        <div className="pb-2.5">
          <FieldConfidenceBadge kind={badgeFor("team")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Year"
          required
          placeholder="e.g. 2025 or 2025/26"
          value={state.year}
          onChange={(e) => set("year", e.target.value)}
          error={errors.year}
        />
        <TextField
          label="Card #"
          required
          placeholder="#140"
          value={state.card_number}
          onChange={(e) => set("card_number", e.target.value)}
          error={errors.card_number}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Manufacturer"
          required
          placeholder="Topps, Panini, ..."
          value={state.manufacturer}
          onChange={(e) => set("manufacturer", e.target.value)}
          error={errors.manufacturer}
        />
        <TextField
          label="Product / Set"
          required
          placeholder="Chrome, Prizm, Finest, ..."
          value={state.product}
          onChange={(e) => set("product", e.target.value)}
          error={errors.product}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Parallel (if any)"
          placeholder="Magenta, Green Geometric, ..."
          value={state.parallel_name}
          onChange={(e) => set("parallel_name", e.target.value)}
        />
        <TextField
          label="Print run (if numbered)"
          placeholder="/250, /1, 5B..."
          value={state.print_run}
          onChange={(e) => set("print_run", e.target.value)}
          error={errors.print_run}
        />
      </div>

      <ToggleField label="Autographed" checked={state.is_auto} onChange={(v) => set("is_auto", v)} />
      <ToggleField label="Rookie card" checked={state.is_rookie} onChange={(v) => set("is_rookie", v)} />

      <SelectField
        label="Condition"
        required
        options={CONDITION_OPTIONS}
        value={state.condition}
        onChange={(e) => set("condition", e.target.value as Condition)}
        hint="Your own honest read — not a professional grade."
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Graded by"
          options={GRADER_OPTIONS}
          placeholder="Not graded"
          value={state.grader}
          onChange={(e) => set("grader", e.target.value as Grader)}
        />
        {state.grader && state.grader !== "None" && (
          <TextField
            label="Professional grade"
            inputMode="decimal"
            value={state.grade}
            onChange={(e) => set("grade", e.target.value)}
            error={errors.grade}
          />
        )}
      </div>

      <p className="text-sm text-ink-70">
        {source === "cert"
          ? `Grade, player, and set come directly from ${state.grader || "the grader"}'s certification record. If something looks off, it's worth double-checking the cert number was scanned correctly.`
          : source === "search"
            ? "Card identity fields came from our checklist database — condition and grade are still yours to fill in."
            : "This is our best read of the card, not a guarantee. Fix anything that's wrong before you save."}
      </p>

      {requireAcquisition && (
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <TextField
            label="Acquisition price"
            placeholder="$0.00"
            inputMode="decimal"
            value={acqPrice}
            onChange={(e) => setAcqPrice(e.target.value)}
            hint="Enter $0 if it was a pack pull or already owned."
            error={acqErrors.price}
          />
          <TextField
            label="Acquisition date"
            type="date"
            value={acqDate}
            onChange={(e) => setAcqDate(e.target.value)}
            error={acqErrors.date}
          />
        </div>
      )}

      <Button type="submit" variant="accent" size="lg" loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
