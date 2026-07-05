---
paths: ["**/*.html", "**/*.css", "**/*.js", "**/*.ts", "**/*.tsx", "**/*.jsx", "**/*.svelte", "**/*.astro", "**/*.py", "**/*.rb", "**/*.go", "**/*.sql", "**/api/**", "**/.env*"]
---
# Security

## HTTP Headers (set at server/CDN level)
These can't be set in static HTML but must be configured in hosting platform (Vercel, Netlify, Cloudflare, nginx):

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- Deploy CSP in **report-only mode first** (`Content-Security-Policy-Report-Only`) to find violations before enforcing
- HSTS `preload` requires registering at hstspreload.org — only add once HTTPS is fully stable

## HTML-level Security
- Never use `target="_blank"` without `rel="noopener noreferrer"` — prevents tab-napping attacks
- Never use `innerHTML` with user-supplied data — use `textContent` instead
- Never interpolate untrusted data into `href`, `src`, or `style` attributes
- Avoid `eval()`, `new Function()`, and `setTimeout(string)` — all execute arbitrary code
- CSP `error pages`: ensure 404/500 pages are also covered by security headers (use `always` in nginx)

## Forms
- All forms submitted cross-origin need CSRF protection (token in hidden field)
- Sensitive fields (`password`, `credit-card`) must use `autocomplete="new-password"` / `autocomplete="off"` appropriately
- Never store sensitive data in `localStorage` — use `sessionStorage` or httpOnly cookies
- Validate all user input server-side — client-side validation is UX only, not security

## External Resources
- Only load scripts/stylesheets over HTTPS
- Use Subresource Integrity (SRI) for CDN-hosted scripts:
  ```html
  <script src="https://cdn.example.com/lib.js"
          integrity="sha384-<hash>"
          crossorigin="anonymous"></script>
  ```
- Audit third-party scripts — each one is a potential supply chain risk

## HTTPS
- Redirect all HTTP traffic to HTTPS at the server/CDN level
- Verify SSL certificate covers all subdomains (wildcard or multi-domain cert)
- Check certificate expiry is monitored and auto-renewed

## Secrets & Environments (full-stack builds)
- Never commit `.env` — verify it's in `.gitignore` before the first commit, not after
- Production, preview, and local dev use separate secrets and separate databases — never point a preview deploy at the production DB
- Rotate any secret that was ever pasted into chat, a screenshot, or a public repo, even briefly
- Store production secrets in the hosting platform's dashboard (Vercel/Netlify env vars) or a secrets manager — never in a `.env` file committed anywhere, including private repos
- OAuth client secrets and DB connection strings are build-and-runtime secrets — confirm which the platform needs at which stage

## Dependency & Infra Security (full-stack builds)
- Enable Dependabot (or equivalent) on the repo so dependency CVEs surface automatically — don't rely on a one-time audit
- Rate-limit at the infra layer (e.g. Upstash Redis, Vercel Edge Config, or platform-native rate limiting) for anything beyond a single auth endpoint — in-process rate limiting doesn't survive serverless cold starts or multiple instances
- Database migrations are additive/backward-compatible by default (add columns nullable, backfill, then tighten) so a mid-deploy rollback doesn't break — don't drop or rename columns in the same migration that ships the code depending on the new shape
- Use the pooled connection string (`-pooler` host) for Neon/serverless Postgres in request-scoped functions — an unpooled connection per invocation exhausts the database's connection limit under concurrent load
- Endpoints that accept frequent small updates (counters, toggles) need optimistic concurrency (a `version`/`updated_at` check in the update's `WHERE` clause, `409` on zero rows affected) — without it, concurrent writes silently overwrite each other instead of failing loudly. See `.claude/agents/backend-developer.md` for the full pattern

## `target="_blank"` quick reference
```html
<!-- WRONG -->
<a href="https://external.com" target="_blank">Link</a>

<!-- CORRECT -->
<a href="https://external.com" target="_blank" rel="noopener noreferrer">Link</a>
```
