import { auth } from '@/auth';

// Protects any route matched below — redirects to "/" if there's no session.
// Adjust the `isProtected` list to the project's actual protected routes.
//
// Next.js 16 deprecated the `middleware.ts` file convention in favour of
// `proxy.ts` (same export shape, just a rename) — this file still works
// (just prints a deprecation warning at build time). Check the Next.js
// version in use at build time and rename to `proxy.ts` if the project's
// Next.js major version has fully removed the old convention.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith('/app') ||       // rename to your app's real protected prefix(es)
    pathname.startsWith('/api/items') || // matches the database-neon-drizzle pattern's example route
    pathname.startsWith('/api/trades');  // matches the trade-matching pattern's example route, if used

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
};
