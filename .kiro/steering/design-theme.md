---
inclusion: fileMatch
fileMatchPattern: "src/ui/**/*"
---
# Visual design: gothic but usable

Goal for the Costume Contest category: a haunting UI that is also clear and accessible. Theme enhances function, it never hides it.

## Palette (define as CSS variables / Tailwind theme tokens)
- --bg: #0B0710 (near-black violet)
- --surface: #170F20
- --surface-2: #22152E
- --blood: #C1121F (primary accent, drain, danger)
- --blood-bright: #FF4D5E (hover, highlights)
- --bone: #F1E9DA (primary text)
- --muted: #A99BB8 (secondary text)
- --garlic: #7BD389 (savings, safe, "staked")
- --gold: #E3B04B (warnings, price hikes)

All text must meet WCAG AA contrast against its background.

## Typography
- Headings: "Cinzel", self-hosted via `@fontsource/cinzel` (never Google Fonts or any CDN), fallback serif
- Body and numbers: "Inter", self-hosted via `@fontsource-variable/inter`, fallback system-ui; use tabular-nums for amounts

## Signature elements
- **Blood Meter**: a vertical or circular gauge that fills with the total yearly drain. Animated fill on load.
- Each vampire shown as a card with a fang/bat icon (inline SVG, no external images) and a "Stake it" button; staked cards get a garlic-green strike effect and the Blood Meter drops.
- Subtle fog gradient background; flickering candle glow on the primary button.
- Microcopy with personality: "3 vampires are feeding on you", "Staked. You saved ₹4,788 a year".

## Rules
- Respect `prefers-reduced-motion`: disable flicker and fill animations.
- Keyboard accessible: visible focus ring in --blood-bright.
- Mobile-first, works at 360px width.
- Always display the privacy badge: "Your statement never leaves this browser."
