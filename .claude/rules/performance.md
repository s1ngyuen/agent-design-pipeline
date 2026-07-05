---
paths: ["**/*.html", "**/*.css", "**/*.js", "**/*.ts", "**/*.tsx", "**/*.jsx", "**/*.svelte", "**/*.astro"]
---
# Performance

## Core Web Vitals targets
- **LCP** (Largest Contentful Paint): < 2.5s — hero images and above-fold text load fast
- **INP** (Interaction to Next Paint): < 200ms — keep JS event handlers lightweight
- **CLS** (Cumulative Layout Shift): < 0.1 — always set explicit `width`/`height` on images

## Fonts
- Use `font-display: swap` to prevent invisible text during font load
- Preconnect to font CDN: `<link rel="preconnect" href="https://fonts.googleapis.com" />`
- Limit to 2 font families and 3–4 weights maximum per page

## Images
- Always set `width` and `height` attributes on `<img>` to prevent CLS
- Use `loading="lazy"` on below-fold images
- Use `loading="eager"` (default) and `fetchpriority="high"` on the hero/LCP image
- Prefer modern formats (WebP/AVIF) for photographs; SVG for icons/logos

## CSS & JS
- Tailwind CDN is fine for prototyping; production builds should use the CLI to purge unused classes
- Defer non-critical scripts: `<script defer src="..."></script>`
- Inline critical CSS for above-fold content when possible

## Responsive Images
- Use `srcset` and `sizes` for images displayed at different widths across breakpoints
