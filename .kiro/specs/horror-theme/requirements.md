# Requirements: Horror theme (Costume Contest redesign)

## Introduction
A visual redesign of Subscription Vampire for the Costume Contest category. The goal is a haunting, polished UI in which every spooky element also helps the user: it shows a value, confirms an action, or marks a state.

This spec changes presentation only. The behaviour, rules, numbers and labels in `.kiro/specs/subscription-vampire/` stay authoritative: detection, savings, decisions, export, privacy and accessibility. Where this spec and that one disagree, that one wins unless this spec names the change.

The changes this spec names are: the coffin-lid delay before the next screen (Requirement 4.4), the display font (Requirement 6, recorded in main spec Requirement 9.4), and the dashboard layout and privacy-badge position (Requirements 9 and 11).

## Glossary
- **Blood vial**: the redesigned Blood Meter. An SVG vial whose liquid level shows the share of the drain still being paid (the existing `meterFill`).
- **Liquid surface**: the wavy top edge of the liquid in the Blood vial.
- **Coffin zone**: the redesigned upload zone, drawn as a coffin with a lid.
- **Stake effect**: the CSS animation played on a card when the user clicks "Stake it": a wooden stake strikes, then the card's vampire icon crumbles to ash.
- **Page chrome**: decorative layers around the content: cobwebs, film grain, vignette and the candle glow.
- **Candle glow**: a soft warm light that follows the mouse pointer behind the content.
- **Display font**: the horror typeface used only for the hero title.
- **Hero title**: the page `<h1>`, "Subscription Vampire".
- **Upload scene**: the full-viewport background on the upload screen: moon, bat silhouettes and layered fog.
- **Privacy seal**: the privacy badge drawn as a wax seal next to its text.
- **Summary column**: on wide screens, the dashboard's left column with the Blood vial, the to-review line, the savings banner and Export.
- **Mandated label**: any exact on-screen text required by `.kiro/specs/subscription-vampire/requirements.md` (listed in Requirement 7).
- **Decorative element**: an element that carries no information not also given as text. It is hidden from assistive technology and never receives pointer events.
- **Reduced motion**: the user's operating system or browser has `prefers-reduced-motion: reduce` set.

## Requirement 1: Blood vial
**User story:** As a user, I want the Blood Meter to look like a vial of my blood that drains as I stake vampires, so that I can see my progress at a glance.

Acceptance criteria:
1. THE system SHALL render the Blood Meter as an inline SVG vial whose liquid height is proportional to the existing Blood Meter fill (yearly drain ÷ (yearly drain + saved per year)), clamped to 0-100%.
2. THE Blood vial SHALL keep the existing text alternative (`role="img"` and an `aria-label` stating the fill percentage and the yearly drain) and the visible yearly and monthly figures.
3. WHILE reduced motion is not set, THE liquid surface SHALL move with a continuous gentle wave animation.
4. WHEN the fill decreases because a vampire is staked, THE liquid level SHALL lower smoothly to the new level over no more than 1 second.
5. WHEN the fill increases (Undo, "Count it" or a new statement), THE liquid level SHALL rise smoothly to the new level over no more than 1 second.
6. WHEN the dashboard first appears, THE liquid SHALL fill from empty to its level over no more than 1.5 seconds.
7. WHILE reduced motion is set, THE Blood vial SHALL show the liquid at its current level with a still surface and no fill, drain or wave animation.
8. IF the fill is 0% THEN THE Blood vial SHALL show an empty vial, still with its text alternative.

## Requirement 2: Stake effect
**User story:** As a user, I want staking a vampire to feel decisive, so that I know the action took effect.

Acceptance criteria:
1. WHEN the user stakes a vampire, THE card SHALL play the Stake effect: a wooden stake strikes the card's vampire icon, then the icon crumbles into falling ash.
2. THE Stake effect SHALL be implemented with CSS animations and inline SVG only, with no JavaScript animation library and no timers driving the animation.
3. THE Stake effect SHALL finish within 1.2 seconds and SHALL end in the existing staked appearance (staked badge, strike-through, open cancel guide). The card SHALL remain in the list.
4. WHILE the Stake effect plays, THE card's text, buttons and cancel guide SHALL remain readable and operable, and the effect SHALL NOT intercept pointer or keyboard input.
5. THE Stake effect SHALL NOT change the state transition, totals or timing defined by the existing spec: the Blood Meter and "Saved per year" SHALL update in the same UI update as the click.
6. WHEN the user clicks Undo on a staked card, THE card SHALL return to its un-staked appearance with the vampire icon restored and no ash shown.
7. WHILE reduced motion is set, THE card SHALL show the final staked appearance immediately, with no stake or ash movement visible.

## Requirement 3: Vampire card decoration
**User story:** As a user, I want each card to look like a vampire's record, so that the dashboard feels part of the theme without hiding information.

Acceptance criteria:
1. THE system SHALL show a fang icon and a bat icon on every vampire card.
2. THE system SHALL show a blood-drip border along the top edge of every vampire card.
3. WHEN a vampire is possibly cancelled, THE card SHALL show a ghost icon in place of the fang icon, in addition to the existing "Possibly cancelled" text badge.
4. THE icons and the blood-drip border SHALL be decorative elements, and SHALL NOT overlap card text or controls at any supported width.
5. THE existing text badges (price hike, price drop, possible duplicate, possibly cancelled, kept, staked, dismissed) SHALL remain, so that no state is shown by icon or colour alone.

## Requirement 4: Coffin upload zone
**User story:** As a user, I want the upload area to be a coffin that opens when I give it a statement, so that the first step feels memorable and clearly responds to my action.

Acceptance criteria:
1. THE upload zone SHALL be drawn as a coffin with a lid. The existing labelled file input, the "Try with sample data" button, the hint text and the error alert SHALL remain.
2. WHILE a file is dragged over the coffin zone, THE lid SHALL lift slightly ajar.
3. WHEN the user drops a file on the coffin zone, chooses one with the file picker, or clicks "Try with sample data", THE lid SHALL open.
4. WHEN the coffin opens for an accepted file or for the sample data, THE system SHALL show the opening for at least 500 ms and no more than 700 ms before showing the next screen (the mapper or the dashboard).
5. IF the file is rejected (not a CSV, empty, over 10 MB or unreadable) THEN THE lid SHALL close and THE existing error message SHALL be shown, without the delay from criterion 4.
6. WHEN the drag leaves the coffin zone without a drop, THE lid SHALL close.
7. THE coffin zone SHALL keep a visible focus indicator around the whole drop area when the file input has keyboard focus.
8. WHILE reduced motion is set, THE lid SHALL change position without animation and THE system SHALL NOT add the delay from criterion 4. Reduced motion is the only case that skips the delay.

## Requirement 5: Page chrome
**User story:** As a user, I want the page to feel like a haunted crypt, so that the theme is immersive.

Acceptance criteria:
1. THE system SHALL show cobwebs in the top corners of the page, a film-grain texture and a vignette, all drawn with inline SVG.
2. WHERE the pointer is a fine pointer (for example a mouse), THE system SHALL show a candle glow that follows the pointer.
3. WHILE reduced motion is set, OR WHERE the primary pointer is coarse (touch), THE candle glow SHALL NOT follow the pointer. A static glow or none MAY be shown instead.
4. THE page chrome SHALL be decorative elements, SHALL sit behind the page content, and SHALL NOT block clicks, taps, text selection or keyboard focus.
5. THE page chrome SHALL NOT cause horizontal scrolling at any width from 360 px up.
6. THE candle glow SHALL update its position at most once per animation frame, and SHALL remove its listeners when the app unmounts.
7. THE page layers SHALL stack in this order, back to front: page background, upload scene (Requirement 10, upload screen only), page chrome, page content.

## Requirement 6: Display font
**User story:** As a user, I want a striking horror title, so that the app is unforgettable at first sight.

Acceptance criteria:
1. THE hero title SHALL use the Creepster display font, self-hosted through `@fontsource/creepster` (SIL Open Font License 1.1).
2. THE display font SHALL be used for the hero title only. All other text SHALL keep the existing fonts (Cinzel headings, Inter body).
3. THE hero title SHALL remain real text with the same words ("Subscription Vampire"), so that it can be read by screen readers and selected.
4. IF the display font fails to load THEN THE hero title SHALL fall back to Cinzel, then serif.
5. THE system SHALL load only the subset and weight the hero title needs.
6. THE repository SHALL include the Creepster copyright notice and the SIL Open Font License text, as the license requires for every distributed copy of the font.

## Requirement 7: Gothic microcopy
**User story:** As a user, I want the wording to match the theme without confusing me, so that it is fun and still clear.

Acceptance criteria:
1. THE system SHALL use gothic wording for headings, hints, status messages and the empty state, as listed in the design.
2. THE system SHALL keep every mandated label exactly as written in `.kiro/specs/subscription-vampire/requirements.md`: "Try with sample data", "N rows skipped", "No vampires found", "Stake it", "Keep", "Dismiss", "Count it", "Undo", "Saved per year", "How to cancel", "Export Stake List", "Clear all data", "Verify in your app, steps may have changed", the cadence and badge labels, and the privacy badge text "Your statement never leaves this browser."
3. WHEN an upload error is shown, THE message SHALL include the existing plain-language explanation and next step. Any gothic wording SHALL be added to it, not substituted for it.
4. THE ₹ symbol and Indian digit grouping SHALL be used in all new copy that shows money.

## Requirement 8: Quality guardrails
**User story:** As a user, I want the redesign to stay fast, private and accessible, so that the theme never gets in my way.

Acceptance criteria:
1. WHILE reduced motion is set, THE system SHALL disable every non-essential animation and transition added by this spec, showing final states immediately.
2. ALL text SHALL meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large text) against the brightest background it can appear on, including any vignette, grain or candle glow behind it.
3. THE redesign SHALL make no network request to any origin other than the app's own, and SHALL add no external URL in CSS, SVG or HTML.
4. THE Content Security Policy injected at build time SHALL remain exactly as it is today.
5. THE app SHALL remain usable at 360 px width with no horizontal scrolling on the upload, mapper and dashboard screens.
6. THE app SHALL remain fully operable by keyboard, with a visible focus ring on every control.
7. ALL decorative elements SHALL carry `aria-hidden="true"` and SHALL NOT receive focus.
8. Animations SHALL change only `transform`, `opacity` and SVG properties that do not trigger layout.
9. THE existing automated tests SHALL keep passing. A test that checks a markup detail this spec replaces (for example a class name) SHALL be updated in the same task, without weakening what it verifies.

## Requirement 9: Two-column dashboard
**User story:** As a user on a wide screen, I want my totals to stay in view while I scroll through the vampires, so that I can see each decision change the Blood vial.

Acceptance criteria:
1. WHERE the viewport is at least 1024 px wide, THE dashboard SHALL use two columns. The left column SHALL hold the Blood vial, the to-review line, the savings banner and the "Export Stake List" button. The right column SHALL hold the vampire list (Subscriptions, Other recurring payments, Dismissed).
2. WHERE the viewport is at least 1024 px wide and at least 640 px tall, THE left column SHALL stay in view (sticky) while the right column scrolls.
3. IF the left column is taller than the viewport THEN all of its content SHALL remain reachable by scrolling and by keyboard focus.
4. WHERE the viewport is narrower than 1024 px, THE dashboard SHALL use one column with the existing order: Blood vial, to-review line, savings banner, Export, then the vampire list. At 360 px there SHALL be no horizontal scrolling.
5. THE "N rows skipped" notice SHALL appear above both columns, and the "Clear all data" button below them.
6. THE keyboard focus order and the screen-reader reading order SHALL follow the visual order: left column, then right column.
7. THE layout change SHALL NOT change any number, label, decision or button on the dashboard.

## Requirement 10: Upload scene
**User story:** As a user arriving at the app, I want a haunting first scene, so that the app is memorable before I upload anything.

Acceptance criteria:
1. WHILE the upload screen is shown, THE system SHALL show a full-viewport scene behind the title and the coffin: a moon, bat silhouettes and at least two layers of fog. It SHALL be built only from inline SVG and CSS.
2. THE upload scene SHALL be a decorative element, SHALL sit behind the page chrome and content, and SHALL NOT block input.
3. WHILE reduced motion is not set, THE bats SHALL fly across the scene and THE fog layers SHALL drift slowly at different speeds.
4. WHILE reduced motion is set, THE bats and fog SHALL be still.
5. THE moon SHALL NOT sit behind any text at any width from 360 px up, so that the title, tagline, coffin text and privacy seal keep WCAG AA contrast.
6. THE upload scene SHALL NOT cause horizontal scrolling at any width from 360 px up.
7. WHEN the app leaves the upload screen (mapper or dashboard), THE upload scene SHALL no longer be shown. WHEN "Clear all data" returns the user to the upload screen, THE scene SHALL be shown again.

## Requirement 11: Privacy seal
**User story:** As a user, I want the privacy promise to look like a sealed seal right under the coffin, so that I notice it at the moment I am deciding whether to upload.

Acceptance criteria:
1. WHILE the upload screen is shown, THE privacy badge SHALL be shown as a wax seal directly below the coffin zone, instead of in the header.
2. WHILE the mapper or dashboard screen is shown, THE privacy badge SHALL still be shown (main spec Requirement 9.2), as a compact seal in the header.
3. THE seal SHALL keep the exact text "Your statement never leaves this browser." as real, readable text. The wax graphic SHALL be a decorative element, and THE text SHALL NOT be placed on the wax.
4. THE seal text SHALL meet WCAG AA contrast against its background.
5. THE privacy badge SHALL appear exactly once on each screen.
