// PSA (and other grading-company) cert verification lookup — adapter
// interface + stub implementation, per plan.md §6 "Recognition Pipeline"
// and §8 open question #2: whether PSA exposes cert verification as a
// public API vs. only a web verification page (which would conflict with
// this project's no-browser-automation principle, same one applied to
// eBay) is genuinely unresolved.
//
// This interface exists specifically so nothing downstream is blocked on
// that answer: `/api/recognize/cert` only depends on `lookupCert()`'s
// signature, not on how it's implemented. Swap `stubCertLookupAdapter` for
// a real implementation once PSA access is confirmed — no caller changes.

import type { CardAttributes, Grader } from '@/domain/types';

export class CertLookupUnavailableError extends Error {
  constructor(message = 'Cert lookup is not yet available — PSA access is unresolved (see plan.md §8).') {
    super(message);
    this.name = 'CertLookupUnavailableError';
  }
}

export class CertNotFoundError extends Error {
  constructor(certNumber: string) {
    super(`No cert record found for ${certNumber}`);
    this.name = 'CertNotFoundError';
  }
}

export interface CertLookupResult extends CardAttributes {
  grade: number;
  grader: Grader;
  cert_number: string;
}

export interface CertLookupAdapter {
  lookupCert(certNumber: string, grader: Grader): Promise<CertLookupResult>;
}

/**
 * Stub adapter — PSA (or BGS/SGC) doesn't currently have a confirmed public
 * API in this project (see brief.md/plan.md Open Questions). Always throws
 * CertLookupUnavailableError so the route can return a clear 501 rather
 * than silently failing or fabricating data. Never calls PSA's web
 * verification page via browser automation, per the same principle applied
 * to eBay (official API or explicit "not implemented," nothing scraped).
 */
export const stubCertLookupAdapter: CertLookupAdapter = {
  async lookupCert(): Promise<CertLookupResult> {
    throw new CertLookupUnavailableError();
  },
};

// Swap this export for a real adapter once cert-lookup access is resolved —
// every caller goes through this single function, not the adapter object
// directly, to keep the swap a one-line change.
export function getCertLookupAdapter(): CertLookupAdapter {
  return stubCertLookupAdapter;
}
