# Implementation tasks

Work top to bottom. Mark each logic task done only when its tests pass. Mark each UI task (7-9) done only when every item of its manual checklist is ticked. Day plan in brackets.

- [ ] 1. Project scaffold [Day 1-2]
  - [x] 1.1 Vite + React + TS (strict) + Tailwind v4 + Vitest + fast-check configured; `npm run test` and `npm run build` pass
  - [ ] 1.2 Folder structure matches `structure.md`; theme tokens in place; fonts self-hosted via `@fontsource/cinzel` and `@fontsource-variable/inter`; CSP with `connect-src 'self'` set; deploy a "hello vampire" page to Vercel/Netlify
    - Checklist: no request to fonts.googleapis.com or other third-party hosts in the browser network tab; CSP header or meta tag present
  - _Requirements: 9, 10_

- [x] 2. Core types, amounts, dates [Day 2]
  - [x] 2.1 Create `types.ts` (Vampire with `tier`, `possiblyCancelled`, price-change `direction`; Decision with `dismiss`)
  - [x] 2.2 Implement `amounts.ts` (`parseAmount`, `parseSignedAmount`, `formatINR`) with example tests
  - [x] 2.3 Write property tests P1 (amount round trip)
  - [x] 2.4 Implement `dates.ts` (two-digit year pivot 00-79 = 20xx, `addMonths` with clamping) with example tests
  - [x] 2.5 Write property tests P2, P3 (date round trip and rejection)
  - _Requirements: 2_

- [x] 3. Statement parsing [Day 2]
  - [x] 3.1 Implement `parseStatement.ts` (preamble, header, column detection, debit/credit/Dr-Cr handling, signed amount where negative = debit)
  - [x] 3.2 Create synthetic fixtures `tests/fixtures/sbi-style.csv` and `tests/fixtures/icici-style.csv` (no real data)
  - [x] 3.3 Tests with three bank-style layouts (HDFC via `data/sample-statement.csv`, `tests/fixtures/sbi-style.csv`, `tests/fixtures/icici-style.csv`)
  - [x] 3.4 Implement `applyMapping` for the manual path, including `flipSign`
  - [x] 3.5 Implement `validateFile` (not CSV, empty, over 10 MB) with example tests
  - _Requirements: 1, 2_

- [x] 4. Merchant normalisation [Day 3]
  - [x] 4.1 Implement `normalizeMerchant.ts` and `merchantAliases.ts` (uppercase key, separate display, specific-first alias order, categories incl. Spotify and YouTube Premium = music)
  - [x] 4.2 Example tests: JioHotstar before Jio, Amazon Pay is not Amazon Prime, each alias matches its own uppercased canonical name, digit runs of 6+ stripped while `ZEE5`, `365`, `1MG` and whole UPI handles like `9876@oksbi` are handled as specified
  - [x] 4.3 Property tests P4, P5
  - _Requirements: 3_

- [x] 5. Recurring detection [Day 3-4]
  - [x] 5.1 Implement `detectRecurring.ts` (windows, 70% gap rule, every-28-days vs monthly rule, amount runs, tiers, price change as last run vs previous run (hike/drop), `currentAmount`, possibly cancelled via `CANCELLED_AFTER_DAYS`, next date via `NEXT_DATE_RULE`, tie sort)
  - [x] 5.2 Property tests P6-P10, including P7b
  - [x] 5.3 Example tests for amount runs and price change (Spotify-style 119 -> 139 gives `currentAmount` 139 and annualDrain 139 x 12), same-day collapse, `CANCELLED_AFTER_DAYS` boundary, month-end clamping
  - [x] 5.4 Verify sample CSV result matches `data/README.md` (seven Subscriptions, rent under Other recurring, nothing possibly cancelled)
  - _Requirements: 4_

- [x] 6. Savings math [Day 4]
  - [x] 6.1 Implement `savings.ts` (eligibility, totals, duplicates)
  - [x] 6.2 Property test P11
  - _Requirements: 5, 6_

- [x] 7. UI shell and theme [Day 5]
  - [x] 7.1 App layout, gothic theme, PrivacyBadge
  - [x] 7.2 UploadZone + sample data button + error states (not CSV, empty, over 10 MB) + `SkippedRowsNotice` ("N rows skipped")
  - [x] 7.3 ColumnMapper with "Flip sign" toggle
  - [x] Manual checklist (all must pass):
    - [x] Whole flow works with keyboard only; focus ring visible on every control
    - [x] Layout works at 360px width with no horizontal scroll
    - [x] Text contrast meets WCAG AA
    - [x] PrivacyBadge is visible on upload, mapper and dashboard screens
    - [x] Non-CSV, empty and 11 MB files each show an error and the app stays usable
    - [x] "N rows skipped" appears for a file with a bad row and not otherwise
    - [x] Mapper "Flip sign" changes which rows are debits
  - _Requirements: 1, 2, 9, 10_

- [x] 8. Dashboard [Day 6]
  - [x] 8.1 BloodMeter (text alternative for screen readers, animation off under reduced motion)
  - [x] 8.2 VampireList and VampireCard: Subscriptions first, collapsed "Other recurring payments", collapsed "Dismissed"; price-hike, price-drop, duplicate and "Possibly cancelled" badges
  - [x] 8.3 Keep / Stake / Dismiss / Count it / Undo and SavingsBanner
  - [x] 8.4 EmptyState ("No vampires found")
  - [x] Manual checklist (all must pass):
    - [x] Sample data shows seven Subscriptions and rent under the collapsed "Other recurring payments"
    - [x] Rent is not in the Blood Meter until "Count it" is clicked, and Undo removes it again
    - [x] Stake, Keep and Dismiss each update Blood Meter, "Saved per year" and the to-review count as specified
    - [x] Spotify shows ₹139 and a "price hike" badge; YouTube Premium and Spotify show the duplicate flag
    - Deferred to Task 9 (not required for Task 8): cancel guide is hidden behind a "How to cancel" toggle on unstaked cards and auto-expanded once a card is staked
    - [x] Badges carry text, not colour alone
    - [x] All buttons reachable and operable by keyboard; Blood Meter has a text alternative
    - [x] 360px layout is usable; reduced motion disables the fill and flicker animations
    - [x] A file with no detectable vampires shows "No vampires found"
  - _Requirements: 5, 6, 10_

- [x] 9. Cancel guides and export [Day 7]
  - [x] 9.1 `cancelGuides.ts` with verified steps, generic fallback, and the "Verify in your app, steps may have changed" note
  - [x] 9.2 Export Stake List as Markdown `.md` (disabled when nothing is staked), Clear all data (reset state, revoke object URLs)
  - [x] Manual checklist (all must pass):
    - [x] A known merchant shows its steps and "last verified" date; an unknown merchant shows the generic steps
    - [x] Cancel guide is hidden behind a "How to cancel" toggle on unstaked cards and auto-expanded once a card is staked (deferred from Task 8)
    - [x] "How to cancel" toggle works by keyboard and exposes its expanded state; staked cards show the guide already expanded
    - [x] Export is disabled with no staked vampires; with some staked, the downloaded `.md` file lists them, amounts (₹), annual savings and steps
    - [x] Export also downloads in the production build (`npm run build` then `npm run preview`), where the Content Security Policy is active
    - [x] "Clear all data" returns to the upload screen with initial state, and a refresh shows no data; export object URLs are revoked (check `URL.revokeObjectURL` is called)
    - [x] 360px layout and reduced motion still hold
  - _Requirements: 7, 8, 9, 10_

- [ ] 10. Polish and ship [Day 8]
  - [x] 10.1 Final accessibility audit (verification only; fixes belong in tasks 7-9): keyboard, contrast, 360px, reduced motion
  - [ ] 10.2 README, final deploy, license visible in repo About
  - [ ] Manual checklist (all must pass):
    - [x] Keyboard only: upload, sample data, mapper, every card button, both collapsed sections, "How to cancel", Export and Clear all data all work; focus ring always visible
    - [x] Contrast: on-screen text meets WCAG AA on every screen
    - [x] 360px: no horizontal scroll on upload, mapper and dashboard, including open cancel guides
    - [x] Reduced motion: no Blood Meter fill or candle flicker animation
    - [ ] README is accurate and includes the live URL
    - [ ] Deployed site loads, "Try with sample data" works, and the network tab shows no third-party requests
    - [ ] Repo is public, includes `.kiro/`, and GitHub shows the MIT license in the About sidebar
  - _Requirements: 10_
