# CI/CD Rules

> **Scope:** Read this during the `deployment` pipeline step (step 10). It replaces "deployment.md is a manual checklist" with "deployment.md documents a workflow that actually runs."

## Principle

A deployment isn't done when a markdown checklist is ticked — it's done when a CI workflow enforces the checklist on every push. Manually re-verifying a checklist by hand is how drift happens (e.g. hosting config says one platform, the site actually serves from another).

## Required Output

Every deployment produces `.github/workflows/ci.yml` in the project folder, not just `deployment.md`. `deployment.md` should describe what the workflow does and link to it, not restate the checklist as prose.

## Workflow shape by stack

**Static (no build step — plain HTML/CSS/JS):**
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Playwright
        run: pip install playwright && playwright install --with-deps chromium
      - name: Smoke test pages
        run: python3 scripts/smoke_test.py   # loads each page, asserts 200 + no console errors
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "trigger hosting platform's git-integration deploy (Netlify/Vercel/Pages auto-deploy on push)"
```

**Full-stack (Next.js/SvelteKit/Astro + backend):**
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck --if-present
      - run: npm run build
      - run: npm test --if-present
  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## Rules

- The `deploy` job must depend on the test/build job (`needs:`) — never deploy on a red build.
- Never hardcode secrets in the workflow file — reference `${{ secrets.NAME }}` and list each required repo secret in `deployment.md`.
- If the stack has a database, add a migration step between build and deploy (e.g. `npx drizzle-kit migrate` / `npx prisma migrate deploy`), gated behind the same `needs:` chain — migrations run after tests pass, before traffic hits new code.
- Run migrations against a preview/staging database in PRs, production database only on `main`.
- If tests don't exist yet for the stack, still commit the workflow with a `test` job that at minimum runs lint + build + typecheck — an empty test suite is a gap to flag, not a reason to skip CI.
- One `ci.yml` covering PRs and `main` is enough for prototype/small projects — don't add multi-environment matrix builds unless the brief specifies staging/prod parity requirements.
