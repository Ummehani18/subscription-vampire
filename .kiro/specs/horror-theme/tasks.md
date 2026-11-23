# Implementation tasks: Horror theme

Work top to bottom. Each task is a UI task: mark it done only when its tests pass **and** every item of its manual checklist is ticked. Behaviour, numbers and mandated labels from `.kiro/specs/subscription-vampire/` must not change. `npm run test` and `npm run build` must pass after every task.

- [ ] 1. Blood vial
  - [ ] 1.1 Add the new tokens (`--blood-deep`, `--glass`, `--ash`, `--ghost`, `--glow`) to `src/index.css`
  - [ ] 1.2 Rewrite `BloodMeter.tsx` as the SVG vial: clipPath from a `useId` with colons stripped, a liquid group positioned by `--vial-offset`, two surface waves; keep `role="img"`, the `aria-label` and the visible figures
  - [ ] 1.3 CSS: `vial-fill` on mount, a transform transition for drain and rise, `vial-wave` loop; all with `both` fill mode
  - [ ] 1.4 Tests: offset for fill 0, 0.5, 1 and clamped -1, 2; text alternative unchanged; replace the `blood-meter-fill` assertions with `vial-liquid` / `vial-wave` and the reduced-motion rule
  - [ ] Manual checklist (all must pass):
    - [ ] The vial fills on load; staking Netflix lowers the level smoothly in under 1 s; Undo raises it again
    - [ ] The liquid surface waves gently and continuously
    - [ ] With reduced motion: the level is correct immediately, the surface is still, and nothing animates
    - [ ] Staking everything empties the vial; the yearly and monthly figures stay readable beside it
    - [ ] 360 px: the vial and figures fit with no horizontal scroll
  - _Requirements: 1, 8_

- [ ] 2. Stake effect
  - [ ] 2.1 `VampireCard`: `data-decision` on the root, a `.vampire-icon` slot, and a `.stake-fx` layer (inline SVG stake plus 8 ash particles), all `aria-hidden` with `pointer-events: none`
  - [ ] 2.2 CSS: `stake-strike`, `ash-crumble` and `ash-fall`, active only under `[data-decision="stake"]`; total at most 1.2 s; the resting state is a greyed icon and no visible stake or ash
  - [ ] 2.3 Tests: `data-decision` per decision; stake layer and icons `aria-hidden`; keyframes use `both`; the staked card still shows the badge, strike-through and open guide; totals and the reducer are untouched (existing tests still pass)
  - [ ] Manual checklist (all must pass):
    - [ ] Clicking "Stake it" shows the stake striking, then the icon crumbling to ash, in about 1 s
    - [ ] The Blood Meter and "Saved per year" update immediately, without waiting for the effect
    - [ ] Buttons, text and the cancel guide stay usable during the effect; keyboard staking (Enter) plays it too
    - [ ] Undo restores the normal icon with no ash; staking again replays the effect
    - [ ] With reduced motion: the final staked look appears at once, with no stake or ash movement
  - _Requirements: 2, 8_

- [ ] 3. Card decoration
  - [ ] 3.1 Bat icon next to the fang icon; ghost icon replaces the fang when `possiblyCancelled` (badge kept)
  - [ ] 3.2 Blood-drip border SVG on the top edge; card top padding grows so drips never touch text
  - [ ] 3.3 Tests: ghost only on possibly cancelled cards (ICICI fixture: Sony LIV, Fresh Milk); every card SVG `aria-hidden`; all existing badge texts still render
  - [ ] Manual checklist (all must pass):
    - [ ] Every card shows fang and bat icons and drips; drips never overlap text or buttons, including at 360 px
    - [ ] Upload `tests/fixtures/icici-style.csv`: Sony LIV and Fresh Milk show a ghost and the "Possibly cancelled" badge
  - _Requirements: 3, 8_

- [ ] 4. Coffin upload zone
  - [ ] 4.1 `UploadZone`: coffin base and lid SVG inside the rectangular label; `lid` state (`closed` / `ajar` / `open`) on `data-lid`; ajar on dragover, closed on dragleave or error, open on drop, picker choice or "Try with sample data"
  - [ ] 4.2 `src/ui/coffinTiming.ts` with `COFFIN_OPEN_MS` and `remainingOpenDelay`; `App.handleFile` (accepted files) and an `async` `App.handleSample` both wait for it before dispatching `statementParsed`; `busy` stays set while waiting; rejected files show their error at once; no wait only under reduced motion
  - [ ] 4.3 Tests: `remainingOpenDelay` examples (start, partway, after, reduced motion, clock skew, 700 ms cap); static markup (`data-lid="closed"`, label `for`, coffin `aria-hidden`, alert with the plain message); static wiring check that both `handleFile` and `handleSample` await the delay
  - [ ] Manual checklist (all must pass):
    - [ ] Dragging a file over the coffin lifts the lid ajar; leaving closes it
    - [ ] Dropping or choosing a valid CSV opens the lid, then the next screen (mapper or dashboard) appears about half a second later
    - [ ] "Try with sample data" opens the lid too, and the dashboard appears about half a second later; the button can't be clicked twice while waiting
    - [ ] A non-CSV, empty or 11 MB file closes the lid and shows the error immediately
    - [ ] Keyboard: Tab to the file input shows a visible focus ring around the whole coffin; Enter opens the picker
    - [ ] With reduced motion: the lid moves without animation and there is no extra wait
    - [ ] 360 px: the coffin, text and buttons fit
  - _Requirements: 4, 8_

- [ ] 5. Page chrome and candle glow
  - [ ] 5.1 `HauntedChrome.tsx`: vignette, grain (`feTurbulence`) and corner cobwebs as inline SVG in a fixed, `aria-hidden`, `pointer-events: none` layer behind the content
  - [ ] 5.2 `src/ui/candleGlow.ts` (`shouldTrackPointer`, `nextGlowPosition`), `useCandleGlow` (one passive `pointermove`, one rAF per frame, media-query listeners, full cleanup) and `CandleGlow.tsx`; static glow when not tracking
  - [ ] 5.3 Tests: the `shouldTrackPointer` truth table; `nextGlowPosition`; the hook adds and removes listeners with injected `window` and `matchMedia`; the chrome is `aria-hidden` and contains no `http` URLs; contrast pairs re-checked with the glow blended over each background
  - [ ] Manual checklist (all must pass):
    - [ ] Cobwebs, grain and vignette are visible but subtle; text stays crisp
    - [ ] With a mouse, the glow follows the pointer smoothly; on a touch device or with reduced motion it stays still
    - [ ] Clicks, text selection and keyboard focus work everywhere; nothing in the chrome can be focused
    - [ ] 360 px: no horizontal scroll caused by the chrome
    - [ ] DevTools Performance: moving the mouse does not cause layout work (only style/paint for the glow)
  - _Requirements: 5, 8_

- [ ] 6. Display font
  - [ ] 6.1 Install `@fontsource/creepster` (approved; license checked as SIL OFL 1.1, see design); import only `latin-400.css`; add `--font-display` and the `.font-display` class on the hero `<h1>` only, with fallback to Cinzel then serif
  - [ ] 6.2 Add `THIRD_PARTY_NOTICES.md` with the Creepster, Cinzel and Inter copyright lines and the OFL 1.1 text
  - [ ] 6.3 Update `.kiro/steering/design-theme.md` Typography with the display font rule, and the main `design.md` Privacy line to name the third font (main Req 9.4 is already amended)
  - [ ] 6.4 Tests: the font is imported from `@fontsource`, not a URL; `.font-display` is used once, on the `<h1>`; the `<h1>` text is "Subscription Vampire"; `THIRD_PARTY_NOTICES.md` names Creepster and contains "SIL OPEN FONT LICENSE Version 1.1"
  - [ ] Manual checklist (all must pass):
    - [ ] The title renders in the display font; nothing else does
    - [ ] Network tab: the font loads from the app's own origin only
    - [ ] Blocking the font file (DevTools request blocking) falls back to Cinzel
    - [ ] The title is readable at 360 px and selectable as text
  - _Requirements: 6, 8_

- [ ] 7. Gothic microcopy
  - [ ] 7.1 Apply the microcopy table from the design; add the error lead before the existing error messages
  - [ ] 7.2 Tests: update the assertions for replaced copy ("Drop your bank statement CSV here", "Every vampire has been reviewed.", the busy status); new test that every mandated label from Requirement 7.2 still renders; error alerts contain both the lead and the full existing message
  - [ ] Manual checklist (all must pass):
    - [ ] The copy reads well on every screen and never hides what to do next
    - [ ] Each upload error (non-CSV, empty, over 10 MB) is still clear about the problem and the fix
  - _Requirements: 7_

- [ ] 8. Two-column dashboard
  - [ ] 8.1 `src/ui/layout.ts` with `containerClassFor(stage, hasVampires)`; `App.tsx` uses it (`max-w-6xl` for a dashboard with vampires, `max-w-3xl` otherwise)
  - [ ] 8.2 `Dashboard.tsx`: `SkippedRowsNotice` full width, then `.dashboard-grid` with a `Summary` section (Blood vial, to-review line, savings banner, Export) before the vampire column; vial stacks above its figures in the column
  - [ ] 8.3 CSS: grid from 1024 px; sticky summary with `max-height` and `overflow-y: auto` from 1024 px wide and 640 px tall; one column below 1024 px; no `overflow` on content wrappers
  - [ ] 8.4 Tests: `containerClassFor` per stage; Summary comes before the list and holds the four items; CSS media queries present; existing dashboard tests still pass
  - [ ] Manual checklist (all must pass):
    - [ ] At 1280 px: two columns; scrolling the cards keeps the vial, totals, savings and Export in view; staking a card updates the vial without scrolling
    - [ ] On a short window (1280 × 600): no sticky; everything in the summary is still reachable
    - [ ] At 1024 px and 768 px: correct switch between two columns and one
    - [ ] At 360 px: one column in the old order, no horizontal scroll
    - [ ] Keyboard: Tab goes through the summary first, then the cards
  - _Requirements: 9, 8_

- [ ] 9. Upload scene
  - [ ] 9.1 `UploadScene.tsx`: moon, 5 bat silhouettes and 3 fog layers as inline SVG in a fixed, `aria-hidden`, `pointer-events: none` layer at `z-index: 0`; rendered by `App.tsx` only on the upload screen
  - [ ] 9.2 CSS: `bat-flight`, `bat-flap` and `fog-drift` with `both`; moon in the right gutter from 1024 px and in a reserved header band below 1024 px; scene clipped so it never widens the page
  - [ ] 9.3 Tests: the scene renders for the upload stage only (static wiring check); markup `aria-hidden` with no `http` URLs; keyframes use `both`; contrast pairs re-checked with the strongest fog blended over `--bg` and `--surface`
  - [ ] Manual checklist (all must pass):
    - [ ] The upload screen shows the moon, flying bats and drifting fog behind the title and coffin
    - [ ] At 360, 768, 1024 and 1440 px the moon never sits behind any text, and there is no horizontal scroll
    - [ ] With reduced motion: bats and fog are still
    - [ ] The scene disappears on the mapper and dashboard, and returns after "Clear all data"
    - [ ] Clicks, drag and drop and keyboard focus on the upload screen all work through the scene
  - _Requirements: 10, 8_

- [ ] 10. Privacy seal
  - [ ] 10.1 `PrivacyBadge.tsx`: `variant` prop (`compact` default, `seal`); wax-seal SVG `aria-hidden`; text beside the wax, never on it, with the exact mandated text
  - [ ] 10.2 `UploadZone` renders the seal directly below the coffin; `showsHeaderBadge(stage)` in `src/ui/layout.ts`; `App.tsx` header shows the compact badge only on the mapper and dashboard
  - [ ] 10.3 Tests: `showsHeaderBadge` per stage; the privacy text appears exactly once in the App's initial render and once in the UploadZone, after the coffin label; seal SVG `aria-hidden`; both variants carry the exact text; contrast pair for the seal text
  - [ ] Manual checklist (all must pass):
    - [ ] Upload screen: the wax seal and its text sit directly below the coffin, and the header has no badge
    - [ ] Mapper and dashboard: the compact badge shows in the header
    - [ ] The privacy text appears exactly once on each screen, and is readable at 360 px
  - _Requirements: 11, 8_

- [ ] 11. Final horror audit
  - [ ] 11.1 Guardrail tests: the CSP string in `vite.config.ts` is unchanged; no external `http(s)` URLs in `src/index.css` or components except cancel-guide links from data; every new keyframe is used with `both` fill mode; every rendered SVG is labelled `role="img"` or `aria-hidden`
  - [ ] 11.2 Run `npm run test` and `npm run build`; record results
  - [ ] Manual checklist (all must pass):
    - [ ] Keyboard only: the whole flow works with a visible focus ring on every control
    - [ ] Contrast: on-screen text meets WCAG AA on every screen, including where the glow, fog and vignette are brightest
    - [ ] Reduced motion: no vial, stake, ash, coffin, bat, fog, glow or flicker movement anywhere
    - [ ] 360 px: no horizontal scroll on upload, mapper and dashboard
    - [ ] `npm run build` then `npm run preview`: the network tab shows only same-origin requests, and the CSP meta tag is present and unchanged
    - [ ] The live Vercel site after deploy passes the same network and CSP check
  - _Requirements: 8_
