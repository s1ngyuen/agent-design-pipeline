// Best-effort parser for a decoded cert-slab QR payload into a cert number +
// grader guess. Real-world payloads are typically a verification URL (e.g.
// psacard.com/cert/<number>) or occasionally just the raw cert number.
// The user always gets to confirm/correct the grader in the form afterward
// (ManualCorrectionForm's "Graded by" field), so a wrong guess here is not
// data loss — just a slightly wrong default.

import type { Grader } from "@/domain/types";

export interface ParsedCertPayload {
  certNumber: string;
  grader: Extract<Grader, "PSA" | "BGS" | "SGC">;
}

export function parseCertPayload(raw: string): ParsedCertPayload | null {
  const lower = raw.toLowerCase();
  let grader: ParsedCertPayload["grader"] = "PSA";
  if (lower.includes("beckett") || lower.includes("bgs")) grader = "BGS";
  else if (lower.includes("sgc")) grader = "SGC";
  else if (lower.includes("psa")) grader = "PSA";

  const digits = raw.match(/\d{6,10}/);
  if (!digits) return null;

  return { certNumber: digits[0], grader };
}
