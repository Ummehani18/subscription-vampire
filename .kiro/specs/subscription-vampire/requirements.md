# Requirements: Subscription Vampire

## Introduction
Subscription Vampire is a client-side web app. A user uploads a bank statement CSV, the app detects recurring charges ("vampires") entirely in the browser, shows the total drain in a "Blood Meter", lets the user mark vampires as Keep or Stake (cancel), and shows cancellation guidance. Theme: gothic horror. Audience: Indian users with UPI, NACH and card-mandate subscriptions.

## Glossary
- **Statement**: a CSV file exported from an Indian bank or card account.
- **Transaction**: one row with date, narration, and a debit or credit amount.
- **Vampire**: a detected recurring debit (same merchant, regular cadence, similar amount).
- **Cadence**: weekly, every-28-days, monthly, quarterly, or yearly.
- **Drain**: the annualised cost of a vampire (amount x periods per year).
- **Stake**: the user's decision to cancel a vampire.

## Requirement 1: Upload a statement
**User story:** As a user, I want to upload my bank statement CSV, so that the app can analyse my spending.

Acceptance criteria:
1. WHEN the user drops or selects a `.csv` file THEN the system SHALL read it locally in the browser without sending it over the network.
2. WHEN the file is not a CSV or is empty THEN the system SHALL show a clear error message and keep the app usable.
3. WHEN the CSV has a preamble before the header row (common in bank exports) THEN the system SHALL locate the header row automatically.
4. WHEN the system can identify date, narration, and amount columns (separate withdrawal/deposit columns, or a single signed amount, or an amount with Dr/Cr marker) THEN it SHALL parse all rows into Transactions.
5. IF the columns cannot be identified THEN the system SHALL show a column-mapping screen so the user can pick the date, narration, and amount columns manually.
6. WHEN the user clicks "Try with sample data" THEN the system SHALL load the bundled synthetic statement and run the analysis.

## Requirement 2: Parse dates and amounts reliably
**User story:** As a user, I want my dates and amounts read correctly, so that the results can be trusted.

Acceptance criteria:
1. The system SHALL parse dates in the formats `DD/MM/YYYY`, `DD/MM/YY`, `DD-MM-YYYY`, `DD-MMM-YYYY`, `DD MMM YYYY`, and `YYYY-MM-DD`, treating numeric dates as day-first.
2. The system SHALL parse amounts containing thousands separators, including Indian grouping (e.g. `1,23,456.78`), currency symbols, and trailing `Dr`/`Cr`, into integer paise.
3. IF a row has an unparseable date or amount THEN the system SHALL skip it, count it, and report "N rows skipped" to the user.
4. WHEN formatting an amount for display THEN the system SHALL use Indian digit grouping with the rupee symbol.

## Requirement 3: Normalise merchants
**User story:** As a user, I want messy bank narrations grouped under one merchant name, so that recurring charges are found.

Acceptance criteria:
1. WHEN a narration contains reference numbers, UPI handles, dates, or bank prefixes (e.g. `UPI-`, `ACH D-`, `NACH`, `POS`, `ECS`, `AUTOPAY`) THEN the system SHALL strip them to produce a clean merchant key.
2. WHEN a narration matches a known merchant alias (e.g. Netflix, Spotify, Hotstar, Google One, YouTube Premium, Amazon Prime, Jio, Airtel) THEN the system SHALL map it to that merchant's canonical name.
3. The normalisation function SHALL be idempotent: normalising an already-normalised key returns the same key.
4. The same merchant appearing with different reference numbers SHALL produce the same key.

## Requirement 4: Detect recurring charges
**User story:** As a user, I want the app to find my subscriptions automatically, so that I do not have to scan the statement by hand.

Acceptance criteria:
1. The system SHALL consider only debit transactions.
2. WHEN a merchant has at least 3 debits whose gaps fit one cadence window (weekly 6-8 days, every-28-days 27-29 days, monthly 28-32 days, quarterly 85-95 days) THEN the system SHALL report it as a Vampire.
3. WHEN a merchant has 2 debits 350-380 days apart THEN the system SHALL report it as a yearly Vampire with lower confidence.
4. The system SHALL require that at least 70% of gaps fall inside the chosen cadence window and at least 70% of amounts are within 10% of the median amount.
5. WHEN the most recent amount differs from the earlier median by more than 5% THEN the system SHALL flag a price change and record old and new amount.
6. WHEN a single one-off debit appears for a merchant THEN the system SHALL NOT report it as a Vampire.
7. The result SHALL NOT depend on the order of rows in the file.
8. Each Vampire SHALL include: merchant, cadence, typical amount, occurrences, last charge date, next expected date, annualised drain, confidence (0-1), and price-change info if any.

## Requirement 5: Show the Blood Meter and vampire list
**User story:** As a user, I want a clear picture of how much I am losing, so that I feel motivated to act.

Acceptance criteria:
1. The system SHALL display the total monthly-equivalent and yearly drain across all non-staked Vampires.
2. The system SHALL list Vampires sorted by annualised drain, highest first.
3. WHEN a Vampire has a price change THEN its card SHALL show a visible price-hike badge.
4. WHEN two or more Vampires fall in the same category (e.g. music streaming, OTT video) THEN the system SHOULD flag them as possible duplicates.
5. WHEN no Vampires are detected THEN the system SHALL show a friendly "No vampires found" state.

## Requirement 6: Stake or keep
**User story:** As a user, I want to mark each subscription as Keep or Stake, so that I can see how much I will save.

Acceptance criteria:
1. WHEN the user clicks "Stake it" on a Vampire THEN the system SHALL mark it as staked and update the Blood Meter and a "Saved per year" total immediately.
2. WHEN the user clicks "Keep" THEN the system SHALL mark it as kept and exclude it from the "to review" count.
3. The user SHALL be able to undo a decision.
4. Decisions SHALL live in memory only for the session unless the user explicitly exports them.

## Requirement 7: Cancellation guidance
**User story:** As a user, I want to know how to cancel a staked subscription, so that I can actually stop the charge.

Acceptance criteria:
1. WHEN a Vampire matches a merchant in the bundled guide data THEN the system SHALL show that merchant's cancellation steps and a "last verified" date.
2. WHEN no merchant guide exists THEN the system SHALL show generic steps: cancel in the app or website, revoke the UPI AutoPay mandate in your UPI app, or remove the card e-mandate, and contact the bank if charges continue.
3. The system SHALL display the note "Verify in your app, steps may have changed".

## Requirement 8: Export
**User story:** As a user, I want to take my Stake List with me, so that I can act on it later.

Acceptance criteria:
1. WHEN the user clicks "Export Stake List" THEN the system SHALL generate a Markdown or plain-text file listing staked Vampires, amounts, annual savings, and cancel steps, and download it locally.

## Requirement 9: Privacy
**User story:** As a user, I want to be sure my financial data stays private.

Acceptance criteria:
1. The system SHALL perform all parsing and analysis in the browser with no network request containing statement data.
2. The system SHALL display a privacy badge on the main screen at all times.
3. WHEN the user clicks "Clear all data" THEN the system SHALL remove all statement data from memory and return to the upload screen.

## Requirement 10: Theme and accessibility
**User story:** As a user, I want the app to feel unforgettable but still be easy to use.

Acceptance criteria:
1. The UI SHALL follow the gothic design system in the design steering doc.
2. The UI SHALL meet WCAG AA text contrast, be fully keyboard-navigable, and work at 360px width.
3. WHEN the user has `prefers-reduced-motion` set THEN the system SHALL disable non-essential animations.
