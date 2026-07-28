import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  getCertLookupAdapter,
  CertLookupUnavailableError,
  CertNotFoundError,
} from '@/lib/recognition/psaCertLookup';

// ── POST /api/recognize/cert ────────────────────────────────────────────────
// Cert flow (plan.md §6): a scanned PSA/BGS/SGC barcode/QR decodes
// client-side to a cert number; this route looks it up by exact key (no
// OCR guesswork). Returns the same CardAttributes shape as the Vision flow.
// PSA access is unresolved (see brief.md/plan.md Open Questions) — the
// adapter is a stub until that's confirmed, so this currently returns 501.

const bodySchema = z.object({
  certNumber: z.string().min(1, 'certNumber is required'),
  grader: z.enum(['PSA', 'BGS', 'SGC']),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsedBody.error.issues },
      { status: 400 },
    );
  }

  const adapter = getCertLookupAdapter();
  try {
    const result = await adapter.lookupCert(parsedBody.data.certNumber, parsedBody.data.grader);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CertLookupUnavailableError) {
      return NextResponse.json({ error: 'not_implemented', message: err.message }, { status: 501 });
    }
    if (err instanceof CertNotFoundError) {
      return NextResponse.json({ error: 'not_found', message: err.message }, { status: 404 });
    }
    console.error('Unexpected error in /api/recognize/cert', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
