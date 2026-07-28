import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { auth } from '@/auth';
import { annotateCardImage, VisionApiError } from '@/lib/recognition/visionClient';
import { parseVisionResult } from '@/lib/recognition/parseVisionResult';

// ── POST /api/recognize/vision ─────────────────────────────────────────────
// Vision flow (plan.md §6): image in, uncertain-by-nature output. Calls
// Google Cloud Vision (object localization + OCR), then a heuristic parser
// maps tokens to CardAttributes with per-field confidence. Never persists —
// the caller (Review page) decides what to save. Always routes to Review;
// this endpoint never auto-saves.

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
    const result = parseVisionResult(raw);
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
    console.error('Unexpected error in /api/recognize/vision', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
