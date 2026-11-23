# Requirements: Subscription Vampire

## Introduction
Subscription Vampire is a client-side web app. A user uploads a bank statement CSV, the app detects recurring charges ("vampires") entirely in the browser, shows the total drain in a "Blood Meter", lets the user mark vampires as Keep, Stake (cancel) or Dismiss, and shows cancellation guidance. Theme: gothic horror. Audience: Indian users with UPI, NACH and card-mandate subscriptions.

## Glossary
- **Statement**: a CSV file exported from an Indian bank or card account.
- **Transaction**: one row with date, narration, and a debit or credit amount.
- **Vampire**: a detected recurring debit (same merchant, regular cadence, stable amount). Every Vampire is in one of two tiers.
- **Subscription** (tier 1): a Vampire whose merchant matches the bundled merchant alias table.
- **Other recurring payment** (tier 2): a Vampire whose merchant matches no alias (for example rent, EMIs, SIPs).
- **Counted**: a Subscription is always counted. An Other recurring payment is counted only after the user clicks "Count it".
- **Cadence**: weekly, every-28-days, monthly, quarterly, or yearly.
- **Occurrence**: all debits at one merchant on one day, collapsed into one.
- **Reference date**: the latest transaction date in the Statement (credits included).
- **Possibly cancelled**: a Vampire whose last charge is more than 1.5 nominal periods before the reference date.
- **Current amount**: the amount of the Vampire's latest charge.
- **Drain**: the annualised cost of a Vampire (current amount x periods per year).
- **Stake**: the user's decision to cancel a Vampire.
- **Dismiss**: the user's decision that a Vampire is not relevant and should be ignored.
- **To review**: the number of Counted Vampires, not possibly cancelled, with no decision yet.

## Requirement 1: Upload a statement
**User story:** As a user, I want to upload my bank statement CSV, so that the app can analyse my spending.

Acceptance criteria:
1. WHEN the user drops or selects a `.csv` file THEN the system SHALL read it locally in the browser, with no request containing statement data.
2. WHEN the file is not a CSV, is empty, or is larger than 10 MB THEN the system SHALL show a clear error message and keep the app usable.
3. WHEN the CSV has a preamble before the header row (common in bank exports) THEN the system SHALL locate the header row automatically.
4. WHEN the system can identify date, narration, and amount columns (separate withdrawal/deposit columns, or a single signed amount where a negative value is a debit, or an amount with Dr/Cr marker) THEN it SHALL parse all rows into Transactions.
5. IF the columns cannot be identified THEN the system SHALL show a column-mapping screen so the user can pick the date, narration, and amount columns manually. The screen SHALL offer a "Flip sign" toggle that treats positive amounts as debits and negative amounts as credits.
6. WHEN the user clicks "Try with sample data" THEN the system SHALL load the bundled synthetic statement and run the analysis.

## Requirement 2: Parse dates and amounts reliably
**User story:** As a user, I want my dates and amounts read correctly, so that the results can be trusted.

Acceptance criteria:
1. The system SHALL parse dates in the formats `DD/MM/YYYY`, `DD/MM/YY`, `DD-MM-YYYY`, `DD-MMM-YYYY`, `DD MMM YYYY`, and `YYYY-MM-DD`, treating numeric dates as day-first. Two-digit years 00-79 SHALL be read as 20xx and 80-99 as 19xx.
2. The system SHALL parse amounts containing thousands separators, including Indian grouping (e.g. `1,23,456.78`), currency symbols, and trailing `Dr`/`Cr`, into integer paise.
3. IF a row has an unparseable date or amount THEN the system SHALL skip it, count it, and report "N rows skipped" to the user.
4. WHEN formatting an amount for display or export THEN the system SHALL use Indian digit grouping with the ₹ symbol. The ₹ symbol SHALL be used everywhere, including UI text.

## Requirement 3: Normalise merchants
**User story:** As a user, I want messy bank narrations grouped under one merchant name, so that recurring charges are found.

Acceptance criteria:
1. WHEN a narration contains reference numbers, UPI handles, dates, or bank prefixes (e.g. `UPI-`, `ACH D-`, `NACH`, `POS`, `ECS`, `AUTOPAY`) THEN the system SHALL strip them to produce a clean merchant key. Only digit runs of 6 or more digits are stripped; shorter tokens (e.g. `Zee5`, `365`, `1mg`) are kept. A UPI handle is stripped as a whole token, including any digits attached to it (e.g. `9876@oksbi`).
2. WHEN a narration matches a known merchant alias (e.g. Netflix, Spotify, Hotstar, Google One, YouTube Premium, Amazon Prime, Jio, Airtel) THEN the system SHALL map it to that merchant's canonical name. Aliases SHALL be checked specific-first, so a more specific alias (e.g. JioHotstar) wins over a generic one (e.g. Jio).
3. The normalisation function SHALL be idempotent: normalising an already-normalised key returns the same key.
4. The same merchant appearing with different reference numbers SHALL produce the same key.
5. The merchant key SHALL be the uppercase canonical string (for example `NETFLIX`). The display name SHALL be a separate value.

## Requirement 4: Detect recurring charges
**User story:** As a user, I want the app to find my subscriptions automatically, so that I do not have to scan the statement by hand.

Acceptance criteria:
1. The system SHALL consider only debit transactions. Debits at one merchant on the same day SHALL collapse into one Occurrence that keeps the largest of those amounts.
2. The system SHALL use these gap windows, in days between consecutive Occurrences: weekly 6-8, every-28-days 27-29, monthly 28-34, quarterly 85-95, yearly 350-380.
3. WHEN a merchant has at least 3 Occurrences (2 for yearly) and at least 70% of the gaps fall inside one cadence window THEN the system SHALL report it as a Vampire. With 2 gaps, both SHALL fit.
4. WHEN both the every-28-days and monthly windows fit THEN the system SHALL choose every-28-days only if at least 70% of the gaps are exactly 28 days and none exceeds 29 days. Otherwise it SHALL choose monthly.
5. The system SHALL require stable amounts. Amounts are stable if either (a) the amounts, in date order, form at most two runs of similar amounts (at most one price change), where an amount is similar to a run if it is within 10% of the first amount of that run, or (b) at least 70% of amounts are within 10% of the median amount.
6. WHEN the last run of similar amounts differs from the previous run by more than 5% THEN the system SHALL record a price change. The old amount is the last amount of the previous run, the new amount is the current amount, and the direction is "hike" if higher or "drop" if lower. With only one run there is no price change.
7. WHEN a single one-off debit appears for a merchant THEN the system SHALL NOT report it as a Vampire.
8. The result SHALL NOT depend on the order of rows in the file.
9. A Vampire whose merchant matches the alias table SHALL be tier 1 (Subscription). Any other Vampire SHALL be tier 2 (Other recurring payment).
10. IF the last charge date is more than 1.5 nominal periods before the reference date THEN the system SHALL mark the Vampire as possibly cancelled and exclude it from all drain and savings totals. Nominal period lengths are weekly 7, every-28-days 28, monthly 30, quarterly 91, yearly 365 days.
11. Yearly Vampires SHALL have a confidence of at most 0.6.
12. Each Vampire SHALL include: merchant, tier, category, cadence, current amount, occurrences, last charge date, next expected date, annualised drain, confidence (0-1), possibly-cancelled flag, and price-change info if any. The next expected date is the last charge date plus one nominal period. For monthly and quarterly it is the same day-of-month 1 or 3 months later, and for yearly the same day next year, each clamped to the end of the month.
13. The annualised drain SHALL be the current amount x periods per year. The median amount is used only for the stability check in 4.5, and even-count medians SHALL be rounded half up to whole paise.

## Requirement 5: Show the Blood Meter and vampire list
**User story:** As a user, I want a clear picture of how much I am losing, so that I feel motivated to act.

Acceptance criteria:
1. The system SHALL display the total monthly-equivalent and yearly drain across all Counted Vampires that are not staked, not dismissed, and not possibly cancelled. Monthly-equivalent is the yearly drain divided by 12, rounded half up.
2. The system SHALL list Vampires sorted by annualised drain, highest first. Ties SHALL be sorted by merchant name, ascending. Each card SHALL show the Vampire's current amount.
3. WHEN a Vampire has a price change THEN its card SHALL show a visible "price hike" badge for a rise or a "price drop" badge for a fall.
4. WHEN two or more Counted Vampires that are not dismissed and not possibly cancelled fall in the same category (music, ott-video, or cloud) THEN the system SHOULD flag each of them as a possible duplicate. Staked Vampires still count and keep the flag. YouTube Premium and Spotify are both in the music category.
5. WHEN no Vampires of either tier are detected THEN the system SHALL show a friendly "No vampires found" state.
6. The system SHALL show Subscriptions first and Other recurring payments in a section that is collapsed by default. Other recurring payments SHALL be excluded from the Blood Meter until the user clicks "Count it" on them. Uncounted cards SHALL offer only "Count it" and "Dismiss"; Keep and Stake appear once counted.
7. WHEN a Vampire is possibly cancelled THEN its card SHALL show a "Possibly cancelled" badge.

## Requirement 6: Stake, keep or dismiss
**User story:** As a user, I want to mark each recurring charge as Keep, Stake or Dismiss, so that I can see how much I will save.

Acceptance criteria:
1. WHEN the user clicks "Stake it" on a Vampire THEN the system SHALL mark it as staked and update the Blood Meter and a "Saved per year" total in the same UI update.
2. WHEN the user clicks "Keep" THEN the system SHALL mark it as kept and exclude it from the "to review" count. It SHALL still count toward the drain.
3. WHEN the user clicks "Dismiss" THEN the system SHALL exclude the Vampire from the drain, the savings, and the "to review" count, and move it to a collapsed "Dismissed" list.
4. The user SHALL be able to undo any decision, including "Count it".
5. Decisions SHALL live in memory only for the session unless the user explicitly exports them. Refreshing the page clears all data by design.

## Requirement 7: Cancellation guidance
**User story:** As a user, I want to know how to cancel a staked subscription, so that I can actually stop the charge.

Acceptance criteria:
1. WHEN a Vampire matches a merchant in the bundled guide data THEN the system SHALL show that merchant's cancellation steps and a "last verified" date.
2. WHEN no merchant guide exists THEN the system SHALL show generic steps: cancel in the app or website, revoke the UPI AutoPay mandate in your UPI app, or remove the card e-mandate, and contact the bank if charges continue.
3. The system SHALL display the note "Verify in your app, steps may have changed".
4. The cancel guide (merchant-specific or generic) SHALL be expanded automatically on staked cards. On all other cards it SHALL be hidden behind a "How to cancel" toggle.

## Requirement 8: Export
**User story:** As a user, I want to take my Stake List with me, so that I can act on it later.

Acceptance criteria:
1. WHEN the user clicks "Export Stake List" THEN the system SHALL generate a Markdown (`.md`) file listing staked Vampires, amounts, annual savings, and cancel steps, and download it locally.
2. The "Export Stake List" button SHALL be disabled when no Vampire is staked.

## Requirement 9: Privacy
**User story:** As a user, I want to be sure my financial data stays private.

Acceptance criteria:
1. The system SHALL perform all parsing and analysis in the browser with no network request containing statement data.
2. The system SHALL display a privacy badge on the main screen at all times.
3. WHEN the user clicks "Clear all data" THEN the system SHALL reset the app state to its initial value, revoke any export object URLs, and return to the upload screen.
4. The app SHALL self-host its fonts (`@fontsource/cinzel`, `@fontsource-variable/inter`) and SHALL ship a Content Security Policy with `connect-src 'self'`.

## Requirement 10: Theme and accessibility
**User story:** As a user, I want the app to feel unforgettable but still be easy to use.

Acceptance criteria:
1. The UI SHALL follow the gothic design system in the design steering doc.
2. The UI SHALL meet WCAG AA text contrast, be fully keyboard-navigable, and work at 360px width.
3. WHEN the user has `prefers-reduced-motion` set THEN the system SHALL disable non-essential animations.
