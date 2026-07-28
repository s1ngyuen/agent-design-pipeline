import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { auth } from '@/auth';
import { annotateCardImage, VisionApiError } from '@/lib/recognition/visionClient';
import { parseVisionResult } from '@/lib/recognition/parseVisionResult';
import { ClaudeParseError } from '@/lib/recognition/claudeParseVisionText';

// ── POST /api/recognize/vision ─────────────────────────────────────────────
// Vision flow (plan.md §6): image in, uncertain-by-nature output. Calls
// Google Cloud Vision (object localization + OCR), then Claude interprets
// the raw OCR text into CardAttributes with per-field confidence (plus cheap
// regex for year/card_number/print_run — see parseVisionResult.ts). Never
// persists — the caller (Review page) decides what to save. Always routes
// to Review; this endpoint never auto-saves.

const bodySchema = z.object({
  // Raw base64 image bytes, no `data:image/...;base64,` prefix. Capped at
  // ~10MB of base64 text (~7.5MB decoded — base64 inflates size by ~4/3),
  // a reasonable ceiling for a phone camera capture, to keep abusively
  // oversized payloads from reaching Google Vision (and from being buffered
  // in memory by this route at all).
  image: z.string().min(1, 'image is required').max(10_000_000, 'image is too large'),
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

  try {
    const raw = await annotateCardImage(parsedBody.data.image);
    const result = await parseVisionResult(raw);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VisionApiError) {
      // Upstream (Vision API) failure — 502, distinct from our own 400/500s.
      // Logged (unlike before) since the client currently discards err.message
      // entirely and shows a generic retry prompt instead — this is the only
      // place the real cause is visible until that's fixed client-side.
      console.error('VisionApiError in /api/recognize/vision:', err.message);
      return NextResponse.json(
        { error: 'vision_api_error', message: err.message },
        { status: 502 },
      );
    }
    if (err instanceof ClaudeParseError) {
      // Distinct from VisionApiError above: Vision's own OCR/localization
      // call succeeded, but the downstream Claude text-interpretation step
      // failed. Keeping these separate matters for debugging which stage
      // broke — 502 since this also wraps an upstream (Anthropic) API failure.
      console.error('ClaudeParseError in /api/recognize/vision:', err.message, '| cause:', err.cause);
      return NextResponse.json(
        { error: 'claude_parse_error', message: err.message },
        { status: 502 },
      );
    }
    console.error('Unexpected error in /api/recognize/vision', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
