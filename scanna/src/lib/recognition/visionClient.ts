// Google Cloud Vision REST wrapper — object localization (find the card in
// frame) + text detection/OCR (read player/set info), per plan.md §6
// "Recognition Pipeline". Plain REST via fetch rather than the
// @google-cloud/vision gRPC client, to avoid pulling that dependency into a
// single-region serverless function (per plan.md §1a).
//
// Auth: many Google Cloud orgs disallow plain API keys via org policy, so
// service-account auth (GOOGLE_VISION_SERVICE_ACCOUNT_JSON) is the primary
// path — google-auth-library mints short-lived OAuth2 access tokens from
// the service-account JSON without pulling in the full gRPC client. Plain
// API keys (GOOGLE_VISION_API_KEY) remain supported as a fallback for orgs
// that do allow them.
//
// This module returns raw Vision API annotations only — mapping those
// annotations to CardAttributes fields (with confidence) is
// parseVisionResult.ts's job, kept separate so the two concerns (calling
// the API vs. interpreting its output) can evolve independently.

import { JWT } from 'google-auth-library';

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
const VISION_SCOPE = 'https://www.googleapis.com/auth/cloud-vision';

// Refresh this many milliseconds before actual expiry, so a request never
// races a token that's about to lapse mid-flight.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Module-scope cache: one JWT client + minted token per warm serverless
// instance, so we're not re-authenticating (a network round trip to
// Google's token endpoint) on every single request.
let cachedJwtClient: JWT | null = null;
let cachedAccessToken: string | null = null;
let cachedTokenExpiryMs = 0;

function getJwtClient(): JWT {
  if (cachedJwtClient) return cachedJwtClient;

  const raw = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new VisionApiError('GOOGLE_VISION_SERVICE_ACCOUNT_JSON is not configured');
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new VisionApiError(
      'GOOGLE_VISION_SERVICE_ACCOUNT_JSON is not valid JSON — paste the full downloaded key file content',
    );
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new VisionApiError(
      'GOOGLE_VISION_SERVICE_ACCOUNT_JSON is missing client_email or private_key',
    );
  }

  cachedJwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [VISION_SCOPE],
  });
  return cachedJwtClient;
}

/**
 * Returns a valid OAuth2 access token for the Vision API, minting a new one
 * via the service-account JWT flow only when the cached token is missing or
 * within TOKEN_REFRESH_MARGIN_MS of expiring.
 */
async function getServiceAccountAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedTokenExpiryMs - TOKEN_REFRESH_MARGIN_MS) {
    return cachedAccessToken;
  }

  const client = getJwtClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new VisionApiError('Failed to mint an access token from the Vision service account');
  }

  cachedAccessToken = token;
  // client.credentials is populated by getAccessToken()/authorize() with the
  // expiry of the token just minted (ms since epoch).
  cachedTokenExpiryMs = client.credentials.expiry_date ?? now + 55 * 60 * 1000;

  return cachedAccessToken;
}

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
  let url = VISION_ENDPOINT;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON) {
    const accessToken = await getServiceAccountAccessToken();
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (process.env.GOOGLE_VISION_API_KEY) {
    url = `${VISION_ENDPOINT}?key=${encodeURIComponent(process.env.GOOGLE_VISION_API_KEY)}`;
  } else {
    throw new VisionApiError(
      'Neither GOOGLE_VISION_SERVICE_ACCOUNT_JSON nor GOOGLE_VISION_API_KEY is configured',
    );
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
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
