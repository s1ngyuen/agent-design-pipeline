---
paths: ["**/*.html", "**/*.css", "**/*.js", "**/*.ts", "**/*.tsx", "**/*.jsx", "**/*.svelte", "**/*.astro"]
---
# Accessibility (a11y)

## Color Contrast
- Normal text: minimum 4.5:1 contrast ratio (WCAG AA)
- Large text (18pt+ or 14pt bold): minimum 3:1
- Icons and UI components: minimum 3:1
- Never use color as the only way to convey meaning — pair with text or icons

## Keyboard & Focus
- Every interactive element (button, link, input) must be reachable via Tab
- Visible focus ring required — never use `outline-none` without a custom replacement
- Logical tab order that matches visual reading order

## Semantic HTML
- One `<h1>` per page; headings in hierarchical order (don't skip levels)
- Use `<button>` for actions, `<a>` for navigation — not `<div>` with click handlers
- Use `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>` landmarks
- All `<img>` elements must have `alt` text; decorative images get `alt=""`

## Screen Reader Support
- Visually hidden but readable text uses `class="sr-only"` (Tailwind built-in)
- Icon-only buttons need `aria-label`
- Form inputs need associated `<label>` elements or `aria-label`
