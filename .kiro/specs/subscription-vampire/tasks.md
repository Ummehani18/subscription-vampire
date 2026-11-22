# Implementation tasks

Work top to bottom. Mark each task done only when its tests pass. Day plan in brackets.

- [ ] 1. Project scaffold [Day 1-2]
  - [ ] 1.1 Vite + React + TS (strict) + Tailwind v4 + Vitest + fast-check configured; `npm run test` and `npm run build` pass
  - [ ] 1.2 Folder structure matches `structure.md`; theme tokens in place; deploy a "hello vampire" page to Vercel/Netlify
  - _Requirements: 10_

- [ ] 2. Core types, amounts, dates [Day 2]
  - [ ] 2.1 Create `types.ts`
  - [ ] 2.2 Implement `amounts.ts` with example tests
  - [ ] 2.3 Write property tests P1 (amount round trip)
  - [ ] 2.4 Implement `dates.ts` with example tests
  - [ ] 2.5 Write property tests P2, P3 (date round trip and rejection)
  - _Requirements: 2_

- [ ] 3. Statement parsing [Day 2]
  - [ ] 3.1 Implement `parseStatement.ts` (preamble, header, column detection, debit/credit/Dr-Cr handling)
  - [ ] 3.2 Tests with three bank-style layouts and `data/sample-statement.csv`
  - [ ] 3.3 Implement `applyMapping` for the manual path
  - _Requirements: 1, 2_

- [ ] 4. Merchant normalisation [Day 3]
  - [ ] 4.1 Implement `normalizeMerchant.ts` and `merchantAliases.ts`
  - [ ] 4.2 Property tests P4, P5
  - _Requirements: 3_

- [ ] 5. Recurring detection [Day 3-4]
  - [ ] 5.1 Implement `detectRecurring.ts`
  - [ ] 5.2 Property tests P6-P10
  - [ ] 5.3 Verify sample CSV result matches `data/README.md`
  - _Requirements: 4_

- [ ] 6. Savings math [Day 4]
  - [ ] 6.1 Implement `savings.ts` (totals, duplicates)
  - [ ] 6.2 Property test P11
  - _Requirements: 5, 6_

- [ ] 7. UI shell and theme [Day 5]
  - [ ] 7.1 App layout, gothic theme, PrivacyBadge
  - [ ] 7.2 UploadZone + sample data button + error states
  - [ ] 7.3 ColumnMapper
  - _Requirements: 1, 9, 10_

- [ ] 8. Dashboard [Day 6]
  - [ ] 8.1 BloodMeter
  - [ ] 8.2 VampireCard list with price-hike and duplicate badges
  - [ ] 8.3 Keep / Stake / Undo and SavingsBanner
  - _Requirements: 5, 6_

- [ ] 9. Cancel guides and export [Day 7]
  - [ ] 9.1 `cancelGuides.ts` with verified steps, generic fallback
  - [ ] 9.2 Export Stake List, Clear all data
  - _Requirements: 7, 8, 9_

- [ ] 10. Polish and ship [Day 8]
  - [ ] 10.1 Accessibility pass, reduced motion, 360px layout
  - [ ] 10.2 README, final deploy, license visible in repo About
  - _Requirements: 10_
