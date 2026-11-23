# Design: Horror theme (Costume Contest redesign)

## Overview
All work is in `src/ui/` and `src/index.css`. Nothing in `src/core/` or `src/data/` changes, and nor do the reducer's actions or the dashboard model's numbers. Every new visual is inline SVG plus CSS. The only new JavaScript is:
- a small hook that positions the candle glow;
- a short lid-opening delay in the upload and sample-data flow;
- two pure layout helpers (`containerClassFor`, `showsHeaderBadge`) that choose the page width and where the privacy badge goes for each screen.

### Every spooky element has a job
| Element | What it does for the user |
|---|---|
| Blood vial | Shows the remaining drain as a liquid level; draining confirms savings |
| Stake effect | Confirms the Stake action and marks the card as dealt with |
| Ghost icon | Marks possibly cancelled vampires at a glance (text badge kept) |
| Fang / bat icons, drip border | Identify a card as a vampire record and separate cards visually |
| Coffin lid | Responds to drag and drop (ajar, then open) and signals that the file was accepted |
| Cobwebs, grain, vignette | Frame the content area and draw the eye to the centre |
| Candle glow | Shows where the pointer is on a dark page |
| Display font | Gives the product a recognisable title |
| Upload scene (moon, bats, fog) | Sets the mood on the first screen and draws the eye down to the coffin |
| Privacy seal | Puts the privacy promise right where the user decides to upload |
| Summary column | Keeps the Blood vial and savings in view while you decide on each card |

## Constraints carried over
- **CSP** (`vite.config.ts`, unchanged):
  - `img-src 'self' data:` allows inline SVG and `data:` SVG backgrounds.
  - `style-src 'self' 'unsafe-inline'` allows React `style` attributes. CSSOM writes (`element.style.setProperty`) are not restricted by CSP.
  - `font-src 'self' data:` allows bundled fonts.
  - No new directive is needed.
- **Reduced motion.** The existing global rule in `index.css` sets every animation and transition duration to `0.01ms` with one iteration. All new animations use `animation-fill-mode: both`, so under reduced motion they jump to their final keyframe. Final keyframes are designed to be the correct resting state. JavaScript that moves things (the candle glow) or waits for an animation (the coffin delay) checks `matchMedia('(prefers-reduced-motion: reduce)')` itself.
- **Accessibility.** Decorative SVGs get `aria-hidden="true"` and `focusable="false"`, and layers get `pointer-events: none`. Existing names, roles, `aria-*` attributes and mandated labels are unchanged.
- **SVG ids.** SVG ids used by `clipPath` and gradients come from `useId()` with `:` stripped (`useId().replace(/:/g, '')`), so `url(#id)` references are valid and unique per instance.

## New design tokens (`src/index.css`)
| Token | Value | Use |
|---|---|---|
| `--blood-deep` | `#6E0A14` | Vial liquid shadow, drip shading. Fill only, never text. |
| `--glass` | `rgb(241 233 218 / 0.18)` | Vial glass outline. Decorative. |
| `--ash` | `#8F8A84` | Ash particles. Decorative. |
| `--ghost` | `#CFC8DC` | Ghost icon. Decorative. |
| `--glow` | `rgb(255 190 120 / 0.10)` | Candle glow colour at its centre (maximum alpha 0.10) |

**Contrast rule.** Text is checked against the brightest background it can sit on. The brightest case is `--surface-2`, plus the candle glow at its centre alpha, plus the vignette's clear centre. `tests/ui/contrast.test.ts` gains a helper that alpha-blends `--glow` over each background and re-checks every text pair at 4.5:1. If a pair fails, the glow alpha is reduced. The text colour never changes.

## Components

### `BloodMeter.tsx`: Blood vial
- **Props unchanged:** `{ yearlyDrain, monthlyDrain, fill }`.
- **Markup:** one `<svg role="img" aria-label="Blood Meter {percent}% full: {₹yearly} a year is still being drained.">`, viewBox `0 0 120 220`. The figures stay as visible text next to the vial, as today.
- **Layers inside the SVG**, all `aria-hidden` children:
  1. Glass body: a rounded tube with a neck and cork, stroked with `--glass`.
  2. `<clipPath id={vialId}>` holding the inner tube shape.
  3. Liquid group `<g class="vial-liquid" style={{ '--vial-offset': offset }}>`, clipped to the tube. It contains a body rect in `--blood` with a `--blood-deep` gradient, plus two surface wave paths (`.vial-wave`, `.vial-wave--back`). Each wave path is twice the vial width.
- **Level.** `offset = innerHeight × (1 − clamp(fill))`. The CSS applies it with `transform: translateY(var(--vial-offset))`.
- **CSS:**
  - `.vial-liquid { transition: transform 0.8s ease-out; animation: vial-fill 1.2s ease-out both; }` with `@keyframes vial-fill { from { transform: translateY(var(--vial-empty)); } }`.
  - `.vial-wave { animation: vial-wave 3.2s linear infinite; }` with `@keyframes vial-wave { to { transform: translateX(-50%); } }`. The back wave runs at 4.6s in reverse at lower opacity.
- **Reduced motion:** the global rule makes the fill and transition instant and the wave still, which meets Req 1.7.
- **Tests:**
  - The existing `blood-meter-fill` class assertions in `tests/ui/dashboard.test.ts` are replaced by `vial-liquid` / `vial-wave` assertions that check the same thing: an animated class that the reduced-motion rule covers.
  - The `role="img"` and `aria-label` assertions are unchanged.
  - A new test checks that `--vial-offset` equals `innerHeight × (1 − fill)` for fill values 0, 0.5, 1, -1 and 2 (clamped).

### `VampireCard.tsx`: Stake effect, icons, drip, ghost
- **Root.** The card root gets `data-decision={decision}` and `data-lapsed={possiblyCancelled}`, and the class `vampire-card` with `position: relative`.
- **Icon slot (`.vampire-icon`):**
  - A ghost SVG when `possiblyCancelled`, otherwise the existing fang SVG.
  - Plus a bat SVG.
  - All `aria-hidden`.
- **Stake layer (`<span class="stake-fx" aria-hidden="true">`)**, over the icon slot with `pointer-events: none`. It contains:
  - an inline SVG wooden stake (`.stake-fx__stake`);
  - 8 ash particles (`.stake-fx__ash`, each with `--i` for its delay and drift).
- **CSS, applied only under `.vampire-card[data-decision="stake"]`:**
  - `.stake-fx__stake { animation: stake-strike 0.45s cubic-bezier(.2,.8,.2,1) both; }`. The stake drops from above (translateY and rotate) to the icon, then fades to opacity 0 at 100%, so nothing is left at rest.
  - `.vampire-icon { animation: ash-crumble 0.6s 0.4s ease-in both; }`. It goes from full colour to greyscale, `opacity: 0.35` and `scale(0.9)`; that is the resting staked look.
  - `.stake-fx__ash { animation: ash-fall 0.7s calc(0.45s + var(--i) * 40ms) ease-in both; }`, with translateY 24px, a sideways drift, and opacity 0.9 → 0.
  - The total is within 1.2s (Req 2.3).
- **Why it doesn't replay on re-render:** CSS animations start when the selector first matches. React re-renders don't re-add the attribute, so the effect does not replay. Undo removes `data-decision="stake"`, so the icon returns to normal (Req 2.6). Staking again replays it.
- **Known edge:** a counted and staked card inside the closed "Other recurring payments" `<details>` may play its animation when the section is first opened. This is acceptable.
- **Drip border (`<svg class="card-drips" aria-hidden="true">`):**
  - A full-width SVG across the top edge, drawn as a path with 5 or 6 drips of varying length, `preserveAspectRatio="none"` horizontally, fill `--blood` over `--blood-deep`.
  - The card's top padding grows by the longest drip (12px), so drips never overlap text (Req 3.4).
  - Static: no animation.
- **Tests (static markup):**
  - `data-decision` is set.
  - A ghost icon appears only when `possiblyCancelled`, and the "Possibly cancelled" badge is still present.
  - `.stake-fx` and `.card-drips` are `aria-hidden`.
  - Every SVG on the card is `aria-hidden`.
  - A CSS test confirms each new keyframe is used with `both` fill mode and that the reduced-motion rule exists.

### `UploadZone.tsx`: Coffin zone
- **Structure.** The existing `<label htmlFor={inputId}>` stays rectangular, so its `focus-within` outline is never clipped (Req 4.7). Inside it, an aria-hidden SVG draws the coffin as two parts: the base (`.coffin-base`) and the lid (`.coffin-lid`). The existing text, hint and "Choose a CSV file" span sit centred over the lid.
- **Lid state:** local `lid: 'closed' | 'ajar' | 'open'`, exposed as `data-lid` on the label.
  - `dragover` sets `ajar`, and `dragleave` sets `closed` (Req 4.2, 4.6).
  - A drop, a file chosen with the picker, or a click on "Try with sample data" sets `open` before calling `onFile` or `onSample` (Req 4.3).
  - When the `error` prop arrives, the lid goes back to `closed` (Req 4.5).
- **CSS:**
  - `[data-lid="ajar"] .coffin-lid { transform: translateY(-6%) rotate(-3deg); }`
  - `[data-lid="open"] .coffin-lid { transform: translate(18%, -14%) rotate(-14deg); opacity: 0.85; }`
  - `.coffin-lid { transition: transform 0.45s ease-out, opacity 0.45s ease-out; transform-box: fill-box; transform-origin: 90% 10%; }`
- **Delay:** a new pure helper in `src/ui/coffinTiming.ts`:
  ```ts
  export const COFFIN_OPEN_MS = 550;
  /** Milliseconds to wait before showing the next screen: the remaining part of the opening, or 0 under reduced motion. */
  export function remainingOpenDelay(startedAt: number, now: number, reducedMotion: boolean): number
  ```
  - **Files:** `App.handleFile` records `performance.now()` when the read starts. On success it awaits `remainingOpenDelay(...)` before dispatching `statementParsed`, whether the next screen is the mapper or the dashboard. On failure it dispatches `fileRejected` at once (Req 4.5).
  - **Sample data:** `App.handleSample` becomes `async`. It records the start, parses the bundled sample, awaits `remainingOpenDelay(...)`, then dispatches `statementParsed`, so file uploads and sample data behave the same (approved decision 3).
  - **Reduced motion is the only skip:** the delay is 0 (Req 4.8). The value is clamped to 0–700 ms (Req 4.4).
  - **No double submit:** while waiting, the reducer's existing `busy` flag stays set (dispatch `readStarted` first), so the input and the sample button stay disabled.
- **360px:** the SVG scales to the label width (`width: 100%`, `height: auto`), with a minimum label height so the text fits.
- **Tests:**
  - `remainingOpenDelay` examples: start, partway, after, reduced motion, clock skew (now < start gives the full delay, clamped).
  - The sample path waits too: `App.tsx` wiring is checked statically, in the same style as the existing Clear-all-data wiring test.
  - Static markup: `data-lid="closed"` initially; the coffin SVG is `aria-hidden`; the label still has `for` pointing at the input; the alert still renders with the plain message.

### `HauntedChrome.tsx` (new): cobwebs, grain, vignette
- Rendered once in `App.tsx` as a child of the root wrapper: `<div class="haunted-chrome" aria-hidden="true">`, with `position: fixed; inset: 0; z-index: 1; pointer-events: none; overflow: hidden`.
- **Stacking (Req 5.7).** The root wrapper gets `isolation: isolate`. Layers from back to front:
  - upload scene: `z-index: 0`, upload screen only;
  - chrome: `z-index: 1`;
  - page content (`header`, `main`, the Clear button): `position: relative; z-index: 2`.
- No content wrapper gets `overflow: hidden` or `overflow: auto`, because that would break the sticky summary column (Requirement 9).
- **Layers, all inline SVG:**
  - **Vignette:** a full-viewport `<svg preserveAspectRatio="none">` with a `radialGradient` from transparent (centre 55%) to `rgb(0 0 0 / 0.55)` at the edges.
  - **Grain:** an `<svg>` with `<filter><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>` applied to a full rect at `opacity: 0.07`, `mix-blend-mode: overlay`. Static.
  - **Cobwebs:** two corner SVGs (top-left, and top-right mirrored), stroked in `--muted` at 0.35 opacity, sized `min(160px, 28vw)`. Fixed position inside the chrome, so they never widen the page (Req 5.5).
- **Tests:** the root is `aria-hidden` with the `haunted-chrome` class; the CSS contains `pointer-events: none` for `.haunted-chrome`; no `http` URLs appear in the markup.

### `CandleGlow.tsx` (new) and `useCandleGlow`
- **Element:** `<div class="candle-glow-cursor" aria-hidden="true">` inside the chrome layer. It is a `radial-gradient(circle at var(--glow-x) var(--glow-y), var(--glow), transparent 220px)` over the viewport.
- **Hook (`src/ui/useCandleGlow.ts`):**
  - Checks a pure helper, `shouldTrackPointer({ reducedMotion, finePointer })` from `src/ui/candleGlow.ts`, using `matchMedia('(prefers-reduced-motion: reduce)')` and `matchMedia('(pointer: fine)')`.
  - When tracking, it adds one passive `pointermove` listener on `window`.
  - The latest coordinates are stored, and a single `requestAnimationFrame` writes `--glow-x` and `--glow-y` with `style.setProperty` (Req 5.6).
  - It also listens for `change` on both media queries.
  - Cleanup removes all listeners and cancels the frame.
- **When not tracking** (reduced motion or touch): the element gets `data-static`, and the CSS shows a fixed glow behind the hero title (Req 5.3).
- **Tests:**
  - The truth table for `shouldTrackPointer`.
  - `nextGlowPosition` (a pure function that formats px values) for normal, negative and fractional input.
  - The hook's add and remove listener calls, with `window` and `matchMedia` injected as dependencies, so no DOM library is needed.

### Display font
- **Package (approved):** `@fontsource/creepster`, approved for the hero title only.
- **License (checked 23 Nov 2026):**
  - `https://unpkg.com/@fontsource/creepster/LICENSE` is the SIL Open Font License 1.1, "Copyright (c) 2011, Font Diner, Inc … with Reserved Font Names 'Creepster'". fontsource.org lists it as `OFL-1.1`.
  - OFL allows bundling with software. Each copy must include the copyright notice and license, the font may not be sold on its own, and modified versions may not use the name "Creepster".
- **License notice (Req 6.6):** add `THIRD_PARTY_NOTICES.md` at the repository root with the Creepster copyright line and the full OFL 1.1 text. While there, add the same for the already bundled Cinzel and Inter (both OFL). The font files are used unmodified.
- **Import:** only `@fontsource/creepster/latin-400.css` in `index.css` (Req 6.5).
- **Token and rule:** `--font-display: 'Creepster', 'Cinzel', serif`, applied by one class `.font-display` on the hero `<h1>` only (Req 6.2, 6.4).
- **Size and spacing:** the title is at least `2.25rem` with `letter-spacing: 0.02em`, since display faces are hard to read small.
- **Steering and spec updates:**
  - Main spec Req 9.4 is already amended to name `@fontsource/creepster` (approved decision 2).
  - In Task 6, `.kiro/steering/design-theme.md` gets one Typography line for the display font, and the main `design.md` Privacy line ("Fonts are self-hosted with …") gets the third font, so both match Req 9.4.
- **Tests:** `index.css` imports the font from `@fontsource`, not a URL; `.font-display` appears exactly once in the `src/ui` markup, on the `<h1>`; the build output contains the font file under `dist/assets`.

### Microcopy
Mandated labels (Req 7.2) are unchanged. New or changed copy:

| Place | Today | New |
|---|---|---|
| Tagline under the title | Find the recurring charges silently draining your account. | Find the recurring charges silently draining your account, before they drain you dry. |
| Upload heading | Upload a statement | Open the crypt |
| Drop text | Drop your bank statement CSV here | Drop your bank statement CSV into the coffin |
| Hint | or press Enter to choose a .csv file (up to 10 MB) | unchanged |
| Busy status | Reading your statement… | Raising your statement from the grave… |
| Error lead (prefix in the alert) | (none) | "The crypt rejects this offering." followed by the existing message |
| Mapper heading | Match your columns | Name your columns |
| Mapper intro | We couldn't recognise this statement's columns… | unchanged, plus "Even the undead need labels." |
| Subscriptions heading | Subscriptions (n) | unchanged (section name used by the spec) |
| Other recurring intro | …left out of the Blood Meter until you click "Count it". | unchanged |
| Empty-state body | We didn't find any recurring charges… Nothing is feeding on you here. | We searched every shadow and found nothing feeding on you. |
| All reviewed | Every vampire has been reviewed. | Every vampire has been judged. |
| Staked banner | You staked N vampires and saved ₹X a year. | unchanged (spec text) |

- **Error lead:** the alert reads "The crypt rejects this offering. That file isn't a CSV. Export your statement as a .csv file and try again." The existing message text, which tests match, stays intact (Req 7.3).
- **Tests:** the tests that assert "Drop your bank statement CSV here" and "Every vampire has been reviewed." are updated to the new text. A new test checks every mandated label still renders.

### Two-column dashboard (Requirement 9)
- **Container width.** The `App.tsx` root wrapper uses `max-w-3xl` today. With the dashboard showing and vampires present it becomes `max-w-6xl`. The upload and mapper screens keep `max-w-3xl`. The class comes from a pure helper `containerClassFor(stage, hasVampires)` in `src/ui/layout.ts`.
- **Structure in `Dashboard.tsx`:** `SkippedRowsNotice` stays first and full width. Below it:
  ```tsx
  <div className="dashboard-grid">
    <section aria-label="Summary" className="summary-column">
      <BloodMeter/>  <to-review line/>  <SavingsBanner/>  <ExportButton/>
    </section>
    <div className="vampire-column"><VampireList/></div>
  </div>
  ```
  The DOM order already matches the visual order, so focus and reading order are left then right (Req 9.6). "Clear all data" stays in `App.tsx` below `<main>` (Req 9.5). The empty-state branch is unchanged.
- **CSS:**
  - `.dashboard-grid { display: grid; gap: 1.5rem; }`
  - `@media (min-width: 1024px) { .dashboard-grid { grid-template-columns: minmax(18rem, 22rem) 1fr; align-items: start; } }`
  - `@media (min-width: 1024px) and (min-height: 640px) { .summary-column { position: sticky; top: 1.5rem; max-height: calc(100dvh - 3rem); overflow-y: auto; } }`
  - The `max-height` with `overflow-y: auto` keeps every item reachable when the column is taller than the viewport (Req 9.3). Its content includes the Export button, so keyboard focus scrolls it into view.
- **Inside the summary column,** the Blood vial stacks the vial above its figures, so it fits 18–22rem.
- **Narrow screens (< 1024 px):** a single column in the same order as today (Req 9.4).
- **Tests:**
  - `containerClassFor` returns the right class for each stage.
  - Static markup: the Summary section comes before the vampire list and contains the meter, the to-review line, the savings banner and Export.
  - The CSS contains the grid and the sticky media queries.
  - Existing dashboard tests still pass (they count `<article>`s before the first `<details>`; the summary contains none).

### `UploadScene.tsx` (new, Requirement 10)
- Rendered by `App.tsx` only while `stage === 'upload'`: `<div class="upload-scene" aria-hidden="true">`, `position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden`. It unmounts on the mapper and dashboard, and shows again after "Clear all data" (Req 10.7).
- **Moon:** an inline SVG circle with a `radialGradient` glow and 3 crater ellipses in `--bone` / `--muted` tones.
  - **≥ 1024 px:** placed in the right-hand gutter outside the 768 px content column (`right: max(2rem, calc((100vw - 48rem) / 2 - 12rem))`, `top: 6vh`, width `min(14vw, 180px)`).
  - **< 1024 px:** the upload screen's header gets a top band (`padding-top: min(30vw, 120px)`) and the moon sits in that band at the top right (width `min(24vw, 96px)`).
  - Either way, no text sits on the moon (Req 10.5). This is checked manually at 360, 768, 1024 and 1440 px.
- **Bats:** 5 inline-SVG bat silhouettes (`.scene-bat`, fill `#05030A`).
  - Each has `animation: bat-flight var(--dur) linear var(--delay) infinite both` (14–26 s), crossing the viewport by `translateX(-20vw → 120vw)` with a small `translateY` wave.
  - Wings flap with `bat-flap` (`scaleY` 1 → 0.55, 0.3 s, alternate).
  - They're kept inside the scene's `overflow: hidden`, so they never widen the page (Req 10.6).
- **Fog:** 3 layers (`.scene-fog--far`, `--mid`, `--near`). Each is an inline SVG twice the viewport width, with blurred ellipses (`feGaussianBlur` inside the SVG) in `rgb(241 233 218 / α)` with α 0.10, 0.16 and 0.22. They drift `translateX(0 → -50%)` over 90 s, 60 s and 40 s, placed in the lower 60% of the viewport.
- **Reduced motion:** bats and fog are still, by the global rule plus `both` (Req 10.4).
- **Contrast:** the contrast test blends the strongest fog colour (α 0.22) over `--bg` and `--surface`, and re-checks every upload-screen text pair at 4.5:1. If a pair fails, the fog α is lowered; text colours are never changed.
- **Tests:**
  - App wiring renders the scene for the upload stage only (a static check of `App.tsx`, as with the Clear-all-data wiring test).
  - The scene markup is `aria-hidden` and has no `http` URLs.
  - `bat-flight`, `bat-flap` and `fog-drift` keyframes are used with `both`.
  - Fog contrast pairs pass.

### Privacy seal (Requirement 11)
- **`PrivacyBadge.tsx`** gets a `variant: 'seal' | 'compact'` prop. The default is `compact`, so existing tests keep passing.
  - **`seal`:** an aria-hidden inline-SVG wax seal, 56 px. It has a wavy-edged circle in `--blood` shaded with `--blood-deep`, and an embossed lock in `--blood-bright`. Beside it, on `--bg`, is the text "Your statement never leaves this browser." in `--garlic`. Garlic on bg passes AA in the contrast test. The text is never on the wax (Req 11.3, 11.4).
  - **`compact`:** today's pill, with a 20 px seal glyph in place of the lock icon.
- **Placement:**
  - `UploadZone` renders `<PrivacyBadge variant="seal" />` directly after the coffin label and before the sample button (Req 11.1).
  - The `App.tsx` header renders `<PrivacyBadge variant="compact" />` only when `showsHeaderBadge(stage)`, which is true for `mapping` and `dashboard` and false for `upload` (`src/ui/layout.ts`).
  - So each screen shows exactly one badge (Req 11.2, 11.5), and main spec Req 9.2 still holds.
- **Tests:**
  - `showsHeaderBadge` for each stage.
  - The UploadZone markup contains the seal text exactly once, after the coffin label.
  - The App initial render contains the text exactly once.
  - The `seal` SVG is `aria-hidden`.
  - Compact and seal both carry the exact mandated text.

## Files
| File | Change |
|---|---|
| `src/index.css` | New tokens, keyframes (`vial-fill`, `vial-wave`, `stake-strike`, `ash-crumble`, `ash-fall`), coffin, chrome, glow and display-font rules, and the font import (after approval) |
| `src/ui/components/BloodMeter.tsx` | Rewritten as the vial |
| `src/ui/components/VampireCard.tsx` | `data-*` attributes, icon slot, stake layer, drips, ghost |
| `src/ui/components/UploadZone.tsx` | Coffin SVG, lid state |
| `src/ui/components/HauntedChrome.tsx`, `CandleGlow.tsx` | New |
| `src/ui/candleGlow.ts`, `src/ui/useCandleGlow.ts`, `src/ui/coffinTiming.ts` | New pure helpers and the hook |
| `src/ui/App.tsx` | Mount the chrome, the hero `font-display` class, the coffin delay in `handleFile`, copy |
| `src/ui/components/*` | Copy changes per the table above |
| `tests/ui/*` | New tests, and updated assertions for replaced markup and copy |
| `.kiro/steering/design-theme.md` | One line for the display font (Task 6) |
| `.kiro/specs/subscription-vampire/design.md` | Privacy line names the third font (Task 6) |
| `THIRD_PARTY_NOTICES.md` | New: Creepster, Cinzel and Inter copyright lines and the OFL 1.1 text (Task 6) |
| `src/ui/layout.ts` | New: `containerClassFor`, `showsHeaderBadge` |
| `src/ui/components/Dashboard.tsx` | Summary and vampire columns |
| `src/ui/components/UploadScene.tsx` | New: moon, bats, fog |
| `src/ui/components/PrivacyBadge.tsx` | `seal` / `compact` variants |

## Testing strategy
- **Same approach as today:** pure helpers in Node, static markup with `renderToStaticMarkup`, CSS text assertions, and injected browser APIs. No new test dependencies.
- **Guardrail tests (Task 8):**
  - The CSP string in `vite.config.ts` equals today's exact value.
  - `src/index.css` and every component contain no `http://` or `https://` except the cancel-guide links that come from `src/data/cancelGuides.ts`.
  - Every new keyframe name is referenced by a class with `both` fill mode.
  - Every SVG rendered on each screen is either `role="img"` with a label or `aria-hidden`.
  - Contrast pairs are re-checked with the glow blend.
- **Manual browser checks** (as in Tasks 7–10): motion feel, reduced motion, 360px, keyboard and focus, the network tab and the CSP in `npm run preview`.

## Resolved decisions
1. **Display font:** `@fontsource/creepster`, hero title only. License checked: SIL OFL 1.1 (see Display font above).
2. **Main spec Req 9.4:** amended to name `@fontsource/creepster` as the hero-title display font.
3. **Coffin delay:** applies to accepted file uploads **and** sample data; skipped only under `prefers-reduced-motion`. Rejected files show their error immediately.
