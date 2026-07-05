---
name: theme-factory
description: This skill should be used when no brand exists in the project brief, or when the user asks to choose a visual theme, colour palette, or font pairing. Present options and apply the chosen theme consistently.
---

Apply professional themes — color palettes and font pairings — consistently across pages and components.

## How It Works

1. Display a theme showcase to the user with at least 8 distinct options
2. Obtain user selection
3. Apply the chosen theme's colors and fonts consistently throughout the build

## Pre-set Themes

Each theme includes:
- Cohesive color palette with hex codes (background, text, primary, accent, border)
- Complementary font pairings (display/heading + body)
- Distinct visual identity and mood label

Cover a range of moods: professional, playful, editorial, natural, dark/moody, bold, minimal, luxury.

## Custom Themes

When existing themes don't fit, generate a custom theme based on user input:
- Define new font and color combinations
- Match the user's specific vision or brief adjectives
- Apply consistently before finalizing the build

## Application Rules

- Apply theme colors and fonts to **all** elements — headings, body, accents, backgrounds, borders
- Export the theme as CSS custom properties at the top of the stylesheet:
  ```css
  :root {
    --color-bg: #...;
    --color-text: #...;
    --color-primary: #...;
    --color-accent: #...;
    --font-display: '...', serif;
    --font-body: '...', sans-serif;
  }
  ```
- Never mix theme tokens with ad-hoc colors
- Maintain visual consistency from top to bottom of every page
