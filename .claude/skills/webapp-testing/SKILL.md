---
name: webapp-testing
description: This skill should be used for all browser-based testing via Playwright. Use when the qa-tester agent needs to test a static HTML file, a running dev server, or a dynamic web application.
---

Python-based testing of local web applications through Playwright automation.

## Decision Tree

- **Static HTML?** → Read the file directly, write a Playwright script targeting `file:///path/to/index.html`
- **Dynamic webapp, server not running?** → Use `with_server.py` helper
- **Dynamic webapp, server running?** → Connect directly via URL

## Key Pattern: Reconnaissance First

Always wait for the page to fully load before inspecting content:

```python
page.wait_for_load_state('networkidle')
```

Inspecting DOM before the page loads is a common mistake — JavaScript may not have executed yet.

## Usage with Dev Server

```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py
```

## Playwright Screenshot Example

```python
python3 -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.goto('file:///path/to/index.html')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='screenshot.png', full_page=True)
    browser.close()
"
```

## Design Philosophy

Treat bundled scripts as black boxes — consult `--help` first rather than reading source code to preserve context window efficiency.
