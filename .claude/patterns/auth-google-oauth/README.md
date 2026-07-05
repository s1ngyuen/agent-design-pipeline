# Pattern: Auth (Google OAuth via NextAuth v5)

## What this provides

Google sign-in via NextAuth v5 (Auth.js), wired to a Drizzle-backed adapter, with JWT sessions and route protection middleware.

## When to use it

Any brief with "Authentication required: Yes" and Google as the sign-in method. Pairs with the database-neon-drizzle pattern (the adapter needs a Postgres backend) — if that pattern isn't also selected, swap `DrizzleAdapter` for whatever adapter matches the chosen database, or drop the adapter entirely for JWT-only auth with no persisted user table.

## Setup steps

1. In Google Cloud Console → APIs & Services → Credentials, create an OAuth 2.0 Client ID.
   - Authorized JavaScript origins: `http://localhost:3000`, `https://<your-vercel-domain>`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://<your-vercel-domain>/api/auth/callback/google`
2. Add dependencies: `next-auth@^5.0.0-beta`, `@auth/drizzle-adapter` (if using the database pattern).
3. Merge `files/schema.auth-tables.ts` into the project's `src/db/schema.ts`.
4. Generate `AUTH_SECRET` with `openssl rand -base64 32`.

## Env vars

| Var | Value |
|---|---|
| `AUTH_SECRET` | random 32-byte base64 string |
| `AUTH_URL` | `http://localhost:3000` (dev) / the production URL |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |

## Lessons Learned

- **NextAuth v5 silently defaults to "database" sessions the moment a `DrizzleAdapter` is configured** — no explicit opt-in required, no warning. This meant every authenticated request did a DB read to validate the session token, and it ran that way in a live production app for over a week before anyone noticed, simply because nobody had set `session.strategy` explicitly. `files/auth.ts` sets `session: { strategy: 'jwt' }` up front specifically so this can't happen silently again. Only switch to `'database'` if server-side session revocation is a genuine, stated requirement — and if you do, leave a comment explaining why, so the next person doesn't "fix" it back to jwt without understanding the tradeoff.
