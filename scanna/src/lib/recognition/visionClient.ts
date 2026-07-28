// Google Cloud Vision REST wrapper — object localization (find the card in
// frame) + text detection/OCR (read player/set info), per plan.md §6
// "Recognition Pipeline". Plain REST via fetch rather than the
// @google-cloud/vision gRPC client, to avoid pulling that dependency into a
// single-region serverless function (per plan.md §1a).
//
// This module returns raw Vision API annotations only — mapping those
// annotations to CardAttributes fields (with confidence) is
// parseVisionResult.ts's job, kept separate so the two concerns (calling
// the API vs. interpreting its output) can evolve independently.

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export interface VisionVertex {
  x?: number;
  y?: number;
}

export interface VisionLocalizedObject {
  name: string;
  score: number;
  boundingPoly: { normalizedVertices: VisionVertex[] };
}

export interface VisionTextAnnotation {
  description: string;
  boundingPoly?: { vertices: VisionVertex[] };
}

export interface VisionRawResult {
  localizedObjectAnnotations: VisionLocalizedObject[];
  textAnnotations: VisionTextAnnotation[];
  fullText: string | null;
}

export class VisionApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'VisionApiError';
  }
}

/**
 * Calls Google Cloud Vision's `images:annotate` REST endpoint with
 * OBJECT_LOCALIZATION + TEXT_DETECTION features for a single image.
 *
 * @param imageBase64 raw base64 image bytes (no `data:image/...;base64,` prefix)
 */
export async function annotateCardImage(imageBase64: string): Promise<VisionRawResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new VisionApiError('GOOGLE_VISION_API_KEY is not configured');
  }

  const res = await fetch(`${VISION_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [
            { type: 'OBJECT_LOCALIZATION', maxResults: 5 },
            { type: 'TEXT_DETECTION', maxResults: 50 },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new VisionApiError(`Vision API request failed: ${res.status} ${body}`, res.status);
  }

  const json = (await res.json()) as {
    responses?: Array<{
      localizedObjectAnnotations?: VisionLocalizedObject[];
      textAnnotations?: VisionTextAnnotation[];
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  const response = json.responses?.[0];
  if (!response) {
    throw new VisionApiError('Vision API returned no response payload');
  }
  if (response.error) {
    throw new VisionApiError(`Vision API error: ${response.error.message}`);
  }

  return {
    localizedObjectAnnotations: response.localizedObjectAnnotations ?? [],
    textAnnotations: response.textAnnotations ?? [],
    fullText: response.fullTextAnnotation?.text ?? response.textAnnotations?.[0]?.description ?? null,
  };
}
