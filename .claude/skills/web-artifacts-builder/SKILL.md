---
name: web-artifacts-builder
description: This skill should be used when building complex interactive web applications requiring React, state management, routing, or shadcn/ui components. Use instead of plain HTML/Tailwind when the project-architect has chosen a React-based stack or when the UI requires significant interactivity.
---

Build elaborate, multi-component HTML artifacts using React, Tailwind CSS, and shadcn/ui.

**Stack**: React 18 + TypeScript + Vite + Parcel (bundling) + Tailwind CSS + shadcn/ui

## Workflow

### Step 1 — Initialize Project
```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

Creates a fully configured project with:
- React + TypeScript (via Vite)
- Tailwind CSS 3.4.1 with shadcn/ui theming
- Path aliases (`@/`) configured
- 40+ shadcn/ui components pre-installed
- All Radix UI dependencies included
- Parcel configured for bundling

### Step 2 — Develop
Edit the generated files. See shadcn/ui docs at https://ui.shadcn.com/docs/components for component reference.

### Step 3 — Bundle to Single HTML
```bash
bash scripts/bundle-artifact.sh
```

Produces `bundle.html` — self-contained with all JS, CSS, and dependencies inlined. Ready to share as an artifact.

### Step 4 — Share with User
Display `bundle.html` as an artifact in the conversation.

### Step 5 — Test (Optional)
Use Playwright or other tools only if issues arise or testing is explicitly requested. Don't test upfront — it adds latency before the user sees the result.

## Design Rules

- Avoid "AI slop": no excessive centered layouts, purple gradients, uniform rounded corners, or Inter font
- Commit to a distinctive aesthetic
- Match complexity to the design vision
