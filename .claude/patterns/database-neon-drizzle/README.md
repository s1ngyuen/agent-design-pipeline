# Pattern: Database (Neon + Drizzle)

## What this provides

A serverless Postgres setup (Neon) with Drizzle ORM, a migration-file workflow, and an optimistic-concurrency convention for any table that receives frequent small updates. Use this whenever a brief needs persistent, queryable, multi-user data — the default database choice for this pipeline.

## When to use it

Any full-stack build where the brief's Data Schemas section describes dynamic, per-user content (not a static/read-only dataset baked into the bundle).

## Setup steps

1. Create a Neon project (neon.tech). In the console, copy **both** connection strings from Connection Details:
   - The **pooled** string (host ends in `-pooler`) → `DATABASE_URL`
   - The **direct** string (no `-pooler`) → `DIRECT_URL`
2. Add dependencies: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` (dev), `dotenv` (dev).
3. Add npm scripts:
   ```json
   "db:generate": "drizzle-kit generate",
   "db:migrate": "drizzle-kit migrate"
   ```
4. After editing `src/db/schema.ts`, run `npm run db:generate`, review the generated SQL in `migrations/`, commit it, then `npm run db:migrate` to apply it. Never run `drizzle-kit push` against anything but a scratch/local database — it applies schema changes with no reviewable history.

## Env vars

| Var | Value | Used by |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | the running app, at runtime |
| `DIRECT_URL` | Neon direct connection string | `drizzle-kit` only, for migrations |

## The optimistic-concurrency convention

Every table that gets frequent small updates (counters, toggles, status changes) gets a `version integer NOT NULL DEFAULT 0` column. Every `PATCH` includes `expectedVersion` in the body, checks `WHERE version = $expectedVersion` in the update, and bumps `version = version + 1`. Zero rows affected → return `409`; the client refetches instead of silently losing a concurrent write. See `files/api/items/[id]/route.ts` and `files/hooks/useItems.example.ts` for the full working example — copy this shape for every new mutable table.

## Lessons Learned

These are real, not hypothetical — found by auditing `panini-wc-tracker-v2`, the first full-stack app this pipeline built without this pattern to draw on:

- **No pooled/direct URL split meant it was unclear which connection served runtime traffic vs. migrations.** The app's `.env.example` and `drizzle.config.ts` both referenced a single `DATABASE_URL`, and the value in use didn't even point at a pooled host. Always provision both named vars from day one, even if the project is small enough that it "probably doesn't matter yet" — retrofitting this later means touching production env vars under pressure instead of getting it right once.
- **Schema changes were applied via ad-hoc `drizzle-kit push`, with no `migrations/` directory and no `db:generate`/`db:migrate` scripts at all.** This meant zero reviewable history of schema changes, no way to run migrations in CI, and no safe way to know what the live schema actually looked like relative to `schema.ts`. Always generate and commit migration files — a `git log` of `migrations/` should tell the full story of the schema's evolution.
- **No `version` column meant a real concurrency bug could only be patched client-side, not actually prevented.** A batch-add feature hit a client-side cache race (two rapid updates could clobber each other in the UI) and was fixed by batching the client requests — a good fix, but it doesn't protect against two different tabs or devices writing to the same row at the same time. That requires the server-side check this pattern bakes in from the start.
