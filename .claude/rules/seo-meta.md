---
paths: ["**/*.html", "**/*.tsx", "**/*.jsx", "**/*.svelte", "**/*.astro"]
---
# SEO & Meta Tags

## Required `<head>` tags on every page
```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Page Title — 50–60 characters</title>
<meta name="description" content="150–160 character unique description." />
<link rel="canonical" href="https://example.com/page" />
```

## Open Graph (social sharing)
```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://example.com/page" />
<meta property="og:title" content="Same or close to <title>" />
<meta property="og:description" content="Same or close to meta description" />
<meta property="og:image" content="https://example.com/og-image.jpg" /><!-- 1200×630px -->
```

## Twitter/X Cards
```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="..." />
```

## Favicon
```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" /><!-- 180×180px -->
```

## Rules
- Title and OG title should align — mismatches confuse search engines and users
- Every page gets a unique title and description — no duplicates
- og:image must be an absolute URL, under 8MB, ideally ~1200×630px
