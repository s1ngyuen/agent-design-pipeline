# Website Builder — Agent Pipeline

This workspace builds websites from scratch using a structured agent pipeline. Every project starts with a brief and flows through planning, design, content, building, testing, and deployment.

## How to Start a New Project
Run `/new-project` to begin the guided interview. It produces a `brief.md` which is the source of truth for everything that follows.

## Agent Pipeline (run in this order)

| Step | Agent | Input | Output |
|------|-------|-------|--------|
| 1 | `project-architect` | `brief.md` | `plan.md` — tech stack, file structure, component hierarchy, API routes, build order |
| 2 | `web-scraper` | Reference URLs from brief | Design tokens, layout structure, copy from reference sites |
| 3 | `designer` | `brief.md` + `plan.md` + scraper output | Design spec — colours, typography, spacing, components |
| 4 | `content-writer` | `brief.md` + `plan.md` | `content.md` — all page copy, meta tags, form labels, CTAs |
| 5 | `backend-developer` | `brief.md` + `plan.md` | APIs, database schema, auth, seed data |
| 6 | `frontend-developer` | `brief.md` + `plan.md` + `content.md` + design spec | All pages and components |
| 7 | `ux-reviewer` | Built pages + `brief.md` | UX issues and recommendations |
| 8 | `code-reviewer` | All code | Security and efficiency issues |
| 9 | `qa-tester` | Built site + `brief.md` | Test results against all pages and user flows |
| 10 | `deployment` | `brief.md` + `plan.md` + built site | Live site, `.github/workflows/ci.yml`, `deployment.md` |

Steps 5 and 6 can run in parallel when frontend has no backend dependency. Steps 7, 8, and 9 can run in parallel.

## Rules

### Always load
@.claude/rules/technical-defaults.md

### Load when editing UI files (auto — paths-scoped)
@.claude/rules/accessibility.md
@.claude/rules/responsive-design.md
@.claude/rules/performance.md
@.claude/rules/seo-meta.md
@.claude/rules/security.md

### Load at deployment (step 10)
@.claude/rules/ci-cd.md

### Reference recreation only — read explicitly when needed
- `.claude/rules/workflow.md` — generate → screenshot → compare → fix loop
- `.claude/rules/design-fidelity.md` — match reference exactly, do not improve

## Project File Structure

```
<project-name>/
├── brief.md                     ← source of truth (from /new-project)
├── plan.md                      ← technical blueprint (from project-architect; regenerate if brief.md's Date changes — see below)
├── content.md                   ← all copy and meta text (from content-writer)
├── deployment.md                ← deployment record (from deployment agent)
├── .github/workflows/ci.yml     ← CI/CD workflow (from deployment agent, see ci-cd.md)
└── references/                  ← all screenshots and reference images
```

## Keeping plan.md in sync with brief.md

`plan.md` starts with a line recording which version of `brief.md` it was generated from: `> Source brief dated: <date>`. Before running any pipeline step past `project-architect`, compare that date against the `**Date:**` field currently in `brief.md`.

- If they match, proceed normally.
- If `brief.md` is newer, the plan is stale — re-run `project-architect` before dispatching any other agent, and tell the user why. Don't silently build against an out-of-date plan.
