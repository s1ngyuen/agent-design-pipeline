# Technical Defaults

## Static / Prototype Builds
Use these defaults when building simple pages, reference recreations, or prototypes with no backend:
- Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com"></script>`)
- Placeholder images from `https://placehold.co/` when sources aren't provided
- Single `index.html` file unless told otherwise
- Mobile-first responsive design

## Full-Stack / Complex Builds
When the `project-architect` has chosen a framework (Next.js, SvelteKit, Astro, etc.):
- Follow the stack defined in `plan.md` — do not default to CDN Tailwind
- Use the `web-artifacts-builder` skill for complex interactive React builds requiring state management, routing, or shadcn/ui components
- Environment variables go in `.env` (never hardcoded); use `.env.example` for documentation
- Database schema changes go through a migration tool tracked in version control (Drizzle Kit, Prisma Migrate, etc.) — never hand-edit the production schema
- Development, preview, and production each get their own database and their own copy of every secret — see `.claude/rules/security.md` for why
- Postgres → Neon is the default provider. Use the pooled connection string (`-pooler` host) as `DATABASE_URL` for runtime queries, and the direct host as a separate `DIRECT_URL` used only for running migrations — see `.claude/agents/backend-developer.md` for the full pattern
- Read `.claude/rules/ci-cd.md` at deployment time — every full-stack build ships with a CI workflow that runs build/lint/test before deploy, not just a manual checklist

## Screenshots (all build types)
Use Playwright (Python) — Node/npx may not be available:
```python
python3 -c "from playwright.sync_api import sync_playwright; ..."
```
