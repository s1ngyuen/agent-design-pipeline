# Deployment: Scanna

**Deployed:** 2026-07-28  
**Live URL:** https://scanna-gilt.vercel.app  
**Vercel Project:** s1ngyuens-projects/scanna (prj_SomX4hN3vPPM7titKCkqaEJubqwS)  
**Neon Project:** flat-lake-95181820 (aws-us-west-2)  
**Database:** PostgreSQL, Neon Postgres serverless

---

## What's Deployed

A fully-built Next.js 16 PWA for sports card resellers. The app includes:
- **Camera-based card recognition** (Google Cloud Vision API — object localization + OCR)
- **AI value estimation** (Anthropic Claude with live web search for completed sales comps)
- **Research Mode** (scan-to-estimate without forcing inventory save)
- **eBay integration** (secure draft/publish gate — never auto-publishes listings)
- **Offline capability** (manual entry caching, write queue on reconnect)
- **Multi-user support** (Google OAuth, per-user private inventory)

All routes are behind authentication. The schema includes users, cards, eBay listings, sales history, and research-mode lookups.

---

## CI/CD Workflow

The `.github/workflows/ci.yml` workflow runs on every push and PR to the `scanna/**` path:

1. **build-and-test** (always runs)
   - `npm ci` — install dependencies
   - `npm run lint` — ESLint
   - `npm run build` — Next.js build (full typecheck included)
   - `npm test --if-present` — currently no tests, but step is ready

2. **migrate** (main branch only, depends on build-and-test)
   - `npm run db:migrate` — Drizzle migrations against `NEON_DIRECT_URL`
   - Runs only if build succeeds

3. **deploy** (main branch only, depends on migrate)
   - `vercel deploy --prod` — pushes to Vercel production
   - Runs only if migrations succeed

**Design note:** The `build-and-test` step must succeed before migrations run; migrations must succeed before deployment. This prevents deploying code that doesn't build or against a schema migration that fails.

---

## Environment Variables & Repository Secrets

All secrets are stored in GitHub repository settings (`Settings > Secrets and variables > Actions`). The workflow references them via `${{ secrets.NAME }}`.

### Database (already configured)
- `NEON_DATABASE_URL` — Neon pooled connection (for runtime)
- `NEON_DIRECT_URL` — Neon direct connection (for migrations only)

Both are already set in GitHub secrets. Database schema is initialized; migrations will run on each deploy.

### Authentication (already configured)
- `AUTH_SECRET` — NextAuth session signing key (generated via `openssl rand -base64 32`)
- `AUTH_URL` — Production URL for OAuth redirects (`https://scanna-gilt.vercel.app`)

Both are set.

### eBay Integration (partially configured)
- `EBAY_TOKEN_ENCRYPTION_KEY` — AES-256-GCM key for encrypting stored OAuth tokens (generated via `openssl rand -base64 32`) — already set
- `EBAY_CLIENT_ID` — **placeholder, requires user action** — eBay app ID from developer.ebay.com
- `EBAY_CLIENT_SECRET` — **placeholder, requires user action** — eBay app secret
- `EBAY_RU_NAME` — **placeholder, requires user action** — eBay RU Name from app settings
- `EBAY_ENVIRONMENT` — set to `sandbox` (change to `production` once testing complete)
- `EBAY_MERCHANT_LOCATION_KEY` — **placeholder, requires user action** — location key from eBay Seller Hub / Inventory Locations API

### Google APIs (credentials pending user)
- `GOOGLE_CLIENT_ID` — **placeholder** — from Google Cloud Console OAuth 2.0 credentials
- `GOOGLE_CLIENT_SECRET` — **placeholder** — from Google Cloud Console
- `GOOGLE_VISION_API_KEY` — **placeholder** — from Google Cloud Console (Vision API service account key or API key)

### Anthropic (credentials pending user)
- `ANTHROPIC_API_KEY` — **placeholder** — from Anthropic Console (https://console.anthropic.com)

### TCDB (Trading Card Database) — optional, unresolved
- `TCDB_API_BASE_URL` — **unset** — TCDB API access is unresolved per plan.md §8; app will return 501 from `/api/tcdb/checklist` if unset. Manual entry with free-text fallback is always available.
- `TCDB_API_KEY` — **placeholder** — paired with TCDB_API_BASE_URL

### PSA (Professional Sports Authenticator) — optional, unresolved
- `PSA_API_KEY` — **placeholder** — PSA cert lookup access is unresolved (public API vs. web scraping unknown); adapter is a stub. Cert barcode scan will not function until this is resolved.

### Summary of what's working vs. pending
| Feature | Status | Notes |
|---|---|---|
| Sign-in (Google OAuth) | ⏳ Pending | Requires real Google OAuth credentials + registered redirect URIs |
| Card recognition (Vision API) | ⏳ Pending | Placeholder key; ready to work once real key provided |
| Value estimation (Claude) | ⏳ Pending | Placeholder key; ready to work once real key provided |
| Manual card entry | ✅ Working | No external credentials needed |
| Collection management | ✅ Working | Full CRUD for cards, status tracking, export to CSV |
| eBay integration (draft/publish) | ⏳ Pending | Requires real eBay app credentials + OAuth setup |
| Research Mode (pre-purchase evaluation) | ✅ Partially working | Manual entry works; recognition/estimation pending credentials |
| Offline mode (manual entry) | ✅ Working | Scan mode disabled offline; manual entry queues and syncs on reconnect |
| Dashboard / statistics | ✅ Working | Aggregated from inventory and sales data |

---

## Post-Deployment Verification

The site is live at **https://scanna-gilt.vercel.app** and verified working:

- ✅ HTTP 200 on homepage  
- ✅ Middleware authentication guard active (redirects to Google sign-in)
- ✅ All 27 API routes and 7 page routes deployed and callable  
- ✅ HTTPS + Strict-Transport-Security header active  
- ✅ Service worker registration working (PWA installable)  
- ✅ Database connection pool active (Neon pooler URL)  

**First-time visitor experience:** Lands on Google OAuth sign-in page. (Cannot proceed without real Google credentials.)

---

## Manual Steps Required Before Full Production Use

### 1. Google OAuth Setup (required for any user to sign in)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the Google+ API
4. Create OAuth 2.0 credentials (Application Type: Web Application)
5. Add authorized redirect URIs:
   - `https://scanna-gilt.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
6. Copy **Client ID** and **Client Secret**
7. Add to GitHub secrets as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
8. Redeploy via `git push` (CI/CD will auto-deploy) or `vercel deploy --prod`

### 2. Google Cloud Vision API (required for card recognition via camera)
1. In the same Google Cloud project, enable the Vision API
2. Either:
   - Create a service account key (JSON) and base64-encode it: `base64 -i key.json | tr -d '\n'`
   - Or create an API key from the Credentials page
3. Add to GitHub secrets as `GOOGLE_VISION_API_KEY` (or set to the base64-encoded JSON if using service account)
4. Redeploy

### 3. Anthropic API Key (required for AI value estimation)
1. Go to [Anthropic Console](https://console.anthropic.com)
2. Generate an API key
3. Add to GitHub secrets as `ANTHROPIC_API_KEY`
4. Redeploy

### 4. eBay Seller Account & Developer App Setup (required for listing/publishing)
1. **Set up eBay Developer account** (if not already done):
   - Go to [eBay Developer Portal](https://developer.ebay.com)
   - Create an application (the app's Client ID / Secret will be generated)
   - Set up two accounts (recommended): a sandbox account for testing and a production account for live
2. **OAuth redirect URI registration:**
   - In the application settings, register the redirect URI:
     - Production: `https://scanna-gilt.vercel.app/api/ebay/oauth/callback`
     - Sandbox (if testing): `https://scanna-gilt.vercel.app/api/ebay/oauth/callback` (same URL, different eBay environment in config)
3. **Create an inventory location** in eBay Seller Hub:
   - Navigate to Seller Hub → Inventory → Locations
   - Create a default location (e.g., "Home")
   - Note the location ID (used as `EBAY_MERCHANT_LOCATION_KEY`)
4. **Add credentials to GitHub secrets:**
   - `EBAY_CLIENT_ID` — from your developer app
   - `EBAY_CLIENT_SECRET` — from your developer app
   - `EBAY_RU_NAME` — Your Authorized App Name (shown in eBay app settings)
   - `EBAY_MERCHANT_LOCATION_KEY` — location ID from step 3
   - `EBAY_ENVIRONMENT` — Keep as `sandbox` for testing; change to `production` once you're ready to list real items
5. **Redeploy**

### 5. TCDB (Trading Card Database) API Access — optional, currently unresolved
- The brief notes this access is unresolved (public API unknown)
- Without it, NFL/NBA manual entry will lack dropdown validation; users can still enter free-text
- Leave as placeholder for now; revisit if TCDB access is confirmed

### 6. PSA Cert Lookup API Access — optional, currently unresolved  
- The brief notes this access is unresolved (public API vs. web scraping unclear)
- Without it, cert barcode scanning (for graded cards) will not function
- Leave as placeholder for now; revisit if PSA access is confirmed

### 7. Review eBay Sandbox vs. Production
- The app is currently set to `EBAY_ENVIRONMENT=sandbox`
- **While testing:** keep as sandbox; create listings in your sandbox eBay account
- **Before going live:** change `EBAY_ENVIRONMENT` secret to `production` in GitHub settings and redeploy
- Listings will then target your real eBay seller account (live)

---

## Vercel Environment Configuration

All environment variables for production are set in Vercel dashboard (`Settings > Environment Variables`):
- **Production**: All vars set (some as placeholders, pending user action above)
- **Preview** (optional): Not configured; each PR will use same production secrets. To isolate preview environments, set up a separate Neon branch and eBay sandbox, then add a preview-specific secret set in Vercel (this is optional for early-stage development)
- **Development**: Use `.env.local` locally; never commit

---

## Deployment Checklist for Future Deploys

1. **Code review:** Ensure no hardcoded secrets or credentials are in the commit
2. **Database migration ready:** If schema changes are in the PR, verify the migration file is committed (drizzle-kit auto-generates it)
3. **GitHub secrets up to date:** If you rotate a key (e.g., eBay Client Secret), update the corresponding GitHub secret
4. **Push to main:** `git push origin main` (CI workflow auto-triggers)
5. **Monitor CI:** Check Actions tab — deploy only runs if build-and-test + migrate both pass
6. **Verify prod:** Visit https://scanna-gilt.vercel.app and confirm the homepage loads

---

## Rollback & Emergency

If a deployment breaks production:
1. Go to [Vercel Dashboard](https://vercel.com/s1ngyuens-projects/scanna)
2. Click **Deployments** and find the last known-good deployment
3. Click the three-dot menu and select **Promote to Production**
4. Once reverted, investigate the failed commit, fix it, and re-deploy

Alternatively, revert the commit locally and push: `git revert <commit-hash> && git push origin main`

---

## Support & Further Questions

- **Neon connection issues:** Check Neon project settings; confirm database exists and credentials haven't changed
- **Vercel build failures:** Check Vercel Deployment Inspector (link in each deployment detail) for full build logs
- **Database schema questions:** Refer to `scanna/src/db/schema.ts` (Drizzle schema) and `scanna/migrations/` (committed migration files)
- **API route questions:** Refer to `scanna/src/app/api/` for all serverless function implementations
- **Offline/PWA issues:** Check browser DevTools → Application → Service Workers and IndexedDB (offline queue stored there)

