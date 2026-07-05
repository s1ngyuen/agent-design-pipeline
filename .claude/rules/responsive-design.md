---
paths: ["**/*.html", "**/*.css", "**/*.js", "**/*.ts", "**/*.tsx", "**/*.jsx", "**/*.svelte", "**/*.astro"]
---
# Responsive Design

## Tailwind breakpoint model
- Unprefixed utilities apply to **all screen sizes** (mobile baseline)
- Prefixed utilities (`sm:`, `md:`, `lg:`, `xl:`) apply **at that breakpoint and above**
- Never use `sm:` to target small screens — use unprefixed classes for mobile styling

## Breakpoints (Tailwind defaults)
| Prefix | Min-width | Typical target |
|--------|-----------|----------------|
| (none) | 0px       | Mobile         |
| `sm:`  | 640px     | Large phone    |
| `md:`  | 768px     | Tablet         |
| `lg:`  | 1024px    | Laptop         |
| `xl:`  | 1280px    | Desktop        |
| `2xl:` | 1536px    | Wide desktop   |

## Layout
- Start with the mobile layout; add breakpoint overrides to scale up
- Test every layout at 375px (iPhone SE), 768px (tablet), and 1440px (desktop)
- Horizontal scroll must never appear at any viewport width — use `overflow-x-hidden` on `<body>` as a safety net
- Use `max-w-screen-xl mx-auto px-4` (or similar) for page containers — never full-bleed text content

## Typography
- Never use fixed `px` font sizes for body text — use `rem` or Tailwind's scale (`text-base`, `text-lg`)
- Use `clamp()` or stepped sizes (`text-2xl md:text-4xl lg:text-5xl`) for headings so they scale naturally
- Minimum body font size 16px (1rem) on mobile — never smaller for paragraph text
- Line length: 45–75 characters per line (`max-w-prose`) for readability

## Touch & Interaction
- Touch targets minimum **44×44px** on mobile (buttons, links, nav items)
- Add `py-3 px-4` minimum to small interactive elements to hit the 44px target
- Never rely on `:hover`-only states for critical UI — pair with `:focus` for keyboard and touch

## Navigation
- Desktop nav hidden on mobile must have a mobile alternative (hamburger menu, bottom nav, etc.)
- Never hide primary navigation entirely on mobile with no replacement
- Mobile menu must be keyboard-accessible and closeable via Escape key

## Images & Media
- Always set explicit `width` and `height` on `<img>` to prevent layout shift (CLS)
- Use `w-full h-auto` for fluid images within containers
- Use `object-cover` with a fixed height container rather than letting images dictate layout
- Embedded videos: wrap in `aspect-video` (`aspect-ratio: 16/9`) so they scale correctly

## Content Priority
- Never hide content from mobile users that desktop users can see unless it's truly irrelevant at that size
- If a section collapses into an accordion/tab on mobile, ensure it still exists — don't `hidden md:block` without a mobile equivalent
