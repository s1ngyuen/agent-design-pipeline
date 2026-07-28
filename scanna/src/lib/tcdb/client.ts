// TCDB (Trading Card Database) checklist client — NFL/NBA only, per
// brief.md ("covers Football/Baseball/Basketball/Hockey only — no
// Soccer/UFC"). Unlike Google Vision/Anthropic/eBay, TCDB does not have a
// well-documented, publicly confirmed REST API in this project's research —
// brief.md/plan.md list it as an integration but neither pins down an
// endpoint shape, and .env.example's TCDB_API_KEY is flagged
// "if required — confirm during backend build." This is the same
// genuinely-unresolved-external-access situation as the PSA cert lookup
// (see lib/recognition/psaCertLookup.ts), given the same adapter-interface
// treatment: a real base URL is read from TCDB_API_BASE_URL (configurable
// rather than hardcoded, since the exact host/path aren't confirmed), and a
// clear TcdbUnavailableError is thrown — never scraped via browser
// automation, and never fabricated placeholder checklist data.

export type TcdbSport = 'NFL' | 'NBA';

export interface TcdbChecklistEntry {
  player: string;
  team: string;
  year: string;
  manufacturer: string;
  product: string;
  card_number: string;
  parallel_name: string | null;
  print_run: number | null;
}

export class TcdbUnavailableError extends Error {
  constructor(message = 'TCDB checklist access is not configured (TCDB_API_BASE_URL/TCDB_API_KEY) — see plan.md §8.') {
    super(message);
    this.name = 'TcdbUnavailableError';
  }
}

export class TcdbApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TcdbApiError';
  }
}

export async function fetchChecklist(sport: TcdbSport): Promise<TcdbChecklistEntry[]> {
  const baseUrl = process.env.TCDB_API_BASE_URL;
  const apiKey = process.env.TCDB_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new TcdbUnavailableError();
  }

  const res = await fetch(`${baseUrl}/checklist?sport=${encodeURIComponent(sport)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new TcdbApiError(`TCDB checklist request failed: ${res.status} ${body}`, res.status);
  }
  const json = (await res.json()) as { entries: TcdbChecklistEntry[] };
  return json.entries ?? [];
}
