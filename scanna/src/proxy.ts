import { auth } from '@/auth';

// Protects every Scanna *page* route except sign-in — redirects to "/" if
// there's no session.
//
// API routes are deliberately NOT redirected here (see the early return
// below). Every API route handler already calls auth() itself and returns
// its own correctly-shaped JSON 401 when there's no session (see e.g.
// src/app/api/cards/route.ts) — that's real, sufficient auth enforcement on
// its own, not just a nice-to-have on top of this layer. Redirecting first
// at the proxy instead swaps that JSON 401 for an HTML redirect-to-"/"
// response, which fetch() then follows silently (ending on a 200 HTML
// page) — client code expecting JSON (apiFetch) had no way to distinguish
// that from a real success until it tried to res.json() an HTML body and
// threw an uncaught SyntaxError. Letting API requests fall through to their
// own auth() check fixes that at the source instead of only patching the
// symptom in apiFetch. Page routes keep the redirect below since (unlike
// API routes) they have no per-route auth check of their own to fall back
// on — this two-tier split is the actual fix, not just "trust the routes
// and remove the check everywhere."
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) return;

  const isLoggedIn = !!req.auth;
  const isPublic = pathname === '/';

  if (!isPublic && !isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  // Everything except static assets, images, and the icons/manifest/service
  // worker served from public/ (needed unauthenticated for the PWA install
  // prompt and offline support).
  //
  // Integration-bug fix note (frontend-developer, PWA task): `sw.js` was
  // added to public/ without being added here, so an unauthenticated
  // service-worker registration request was redirected to "/" — browsers
  // reject a redirected response for a service-worker script fetch outright
  // ("The script resource is behind a redirect, which is disallowed."),
  // silently breaking offline support for anyone who hadn't already signed
  // in once this session. Fixed by excluding /sw.js below.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|offline.html|sw.js).*)'],
};
