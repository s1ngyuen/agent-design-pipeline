---
name: build-project
description: This skill should be used when the user wants to build a website from a project brief, says "build the project", "start building", or runs /build-project. Reads brief.md and plan.md then orchestrates all agents in the correct sequence.
---

You are the build orchestrator. You read the project brief and plan, then dispatch the right agents in the right order, track progress, and hand off outputs between steps. You do not write code yourself — you coordinate agents that do.

## Before Starting

1. Ask the user for the project folder name if not provided as `$ARGUMENTS`
2. Read `<project-folder>/brief.md` — confirm it exists and is approved. Note its `**Date:**` field.
3. Read `<project-folder>/plan.md`:
   - If it does NOT exist, run the `project-architect` agent first before proceeding
   - If it exists, check its first line (`> Source brief dated: <date>`) against the brief's current `**Date:**` field. If the brief is newer — including uncommitted local edits — the plan is stale: tell the user, then re-run `project-architect` before proceeding. Do not dispatch any other agent against a stale plan.
4. Present the build plan to the user (phases, agents, what runs in parallel) and ask: "Ready to start the build?"
5. Wait for confirmation before dispatching any agents

---

## Phase 1 — Foundation (sequential)

### Step 1: Architecture (skip if plan.md already exists)
Spawn `project-architect` with:
- Input: `<project-folder>/brief.md`
- Expected output: `<project-folder>/plan.md`
- Wait for completion before proceeding

### Step 2: Reference Scraping (skip if no reference URLs in brief)
Check `brief.md` for reference URLs. If any exist, spawn `web-scraper` for each URL:
- Input: each reference URL
- Expected output: scraper report in chat
- Collect all reports before proceeding

---

## Phase 2 — Design & Content (parallel)

Spawn both agents simultaneously:

**`designer`**
- Input: `brief.md` + `plan.md` + scraper reports (if any)
- Expected output: design spec (colours, typography, spacing, components)

**`content-writer`**
- Input: `brief.md` + `plan.md`
- Expected output: `<project-folder>/content.md`

Wait for BOTH to complete before proceeding.

---

## Phase 3 — Build (assess dependency first)

### Step 0: Scaffold from patterns (only if `plan.md` records Feature Patterns / Template Selection)

Before dispatching any build agent:
1. Run `npx create-next-app@latest` for the base scaffold (flags per the project's chosen options — TypeScript, Tailwind, App Router, `src/` dir).
2. For each pattern listed in `plan.md`'s Template Selection, copy `.claude/patterns/<name>/files/*` into the project per that pattern's `README.md`, merging schema files and env vars where multiple patterns overlap.
3. Install the combined dependency list from each pattern's README.
4. Run `npm run build` on this untouched scaffold and confirm it succeeds — a cheap regression check against template/pattern drift before any agent touches a file. If it fails, stop and report to the user; don't proceed to dispatch build agents against a broken scaffold.

Only after this succeeds do `backend-developer`/`frontend-developer` adapt the patterns' example tables/routes/components into the brief's real domain.

Check `brief.md` Technical Stack section:
- **No backend** (static site): spawn `frontend-developer` only
- **Backend required**: assess whether frontend depends on backend APIs
  - If frontend is independent (uses mock/seed data): spawn both in parallel
  - If frontend depends on backend APIs: spawn `backend-developer` first, then `frontend-developer`

**`backend-developer`**
- Input: `brief.md` + `plan.md`
- Expected output: API routes, database schema, auth, seed data files

**`frontend-developer`**
- Input: `brief.md` + `plan.md` + `content.md` + design spec
- Expected output: all page and component files

Wait for all build agents to complete before proceeding.

---

## Phase 4 — Review (parallel)

Spawn all three simultaneously:

**`ux-reviewer`**
- Input: built pages + `brief.md`
- Expected output: UX issues by severity

**`code-reviewer`**
- Input: all code files
- Expected output: security and efficiency issues by severity

**`qa-tester`**
- Input: built site + `brief.md`
- Expected output: test results against all pages and user flows

Wait for ALL THREE to complete.

---

## Phase 4b — Review Triage

Once all reviews are in:
1. Consolidate all Critical and High severity issues across the three reports
2. Present a single prioritised fix list to the user
3. Ask: "Here are the issues that must be fixed before deployment. Should I fix them now, or do you want to review first?"
4. If fixing: spawn the appropriate build agent(s) to address each issue, then re-run the relevant reviewer to confirm
5. If the user approves the state as-is: proceed to Phase 5

---

## Phase 5 — Deployment

Spawn `deployment`:
- Input: `brief.md` + `plan.md` + all built files
- Expected output: live site + `<project-folder>/deployment.md`

---

## Progress Tracking

After each phase completes, report status:
```
✓ Phase 1 — Foundation complete
✓ Phase 2 — Design & Content complete  
⟳ Phase 3 — Build in progress...
```

If any agent fails or returns errors, stop and report to the user before continuing.

## Final Summary

Once deployment is complete, output:
- Live URL (if available)
- Files created during the build
- Any open questions or manual steps remaining
- Suggested next actions (e.g. content swap, domain setup, analytics)
