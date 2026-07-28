// Thin fetch wrapper shared by every hook/component that talks to Scanna's
// own API routes. Never used with third-party endpoints directly (those are
// server-side only, per security.md).

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const SESSION_EXPIRED_MESSAGE = "You've been signed out. Sign in again to pick up where you left off.";

function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

async function parseErrorBody(res: Response): Promise<{ message: string; body: unknown }> {
  // A non-JSON body here is almost always a session-expiry redirect landing
  // back on "/" (HTML), not one of our routes' own JSON error responses —
  // every route returns JSON even on failure, so this branch means the
  // request never reached app code at all. Surface a clean, actionable
  // message instead of trying (and failing) to JSON-parse an HTML page.
  if (!isJsonResponse(res)) {
    return { message: SESSION_EXPIRED_MESSAGE, body: undefined };
  }
  try {
    const body = await res.json();
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message)
        : typeof body === "object" && body && "error" in body
          ? String((body as { error?: unknown }).error)
          : "Couldn't connect. Check your connection and try again.";
    return { message, body };
  } catch {
    return { message: "Couldn't connect. Check your connection and try again.", body: undefined };
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Couldn't connect. Check your connection and try again.", 0);
  }

  if (!res.ok) {
    const { message, body } = await parseErrorBody(res);
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as T;

  // A 200-range response with a non-JSON body is the same session-expiry
  // redirect case as above, just landing on a 2xx instead of a 4xx (fetch
  // follows the redirect to "/" and that page loads fine) — guard the parse
  // here too rather than letting res.json() throw an uncaught SyntaxError.
  if (!isJsonResponse(res)) {
    throw new ApiError(SESSION_EXPIRED_MESSAGE, res.status);
  }

  return (await res.json()) as T;
}

export const swrFetcher = <T,>(url: string): Promise<T> => apiFetch<T>(url);
