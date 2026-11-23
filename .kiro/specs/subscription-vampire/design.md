# Design: Subscription Vampire

## Overview
A static, client-only React + TypeScript app. All logic is in pure functions under `src/core/`. The UI is a thin layer over them. Data flows one way:

```
CSV text -> parseStatement -> Transaction[] -> normalizeMerchant (per row)
        -> detectRecurring -> Vampire[] -> savings (totals) -> UI
```

## Domain types (`src/core/types.ts`)
```ts
export type Paise = number; // integer, rupees * 100

export interface Transaction {
  date: string;          // 'YYYY-MM-DD'
  narration: string;     // raw text
  amount: Paise;         // always positive
  direction: 'debit' | 'credit';
}

export type Cadence = 'weekly' | 'every28days' | 'monthly' | 'quarterly' | 'yearly';

export interface PriceChange { from: Paise; to: Paise; direction: 'hike' | 'drop'; }

export type Tier = 'subscription' | 'other'; // subscription = merchant matched the alias table

export interface Vampire {
  merchant: string;        // display name
  key: string;             // uppercase canonical string, e.g. 'NETFLIX'
  category: string;        // 'ott-video' | 'music' | 'fitness' | 'cloud' | 'telecom' | 'other' ...
  tier: Tier;
  cadence: Cadence;
  currentAmount: Paise;    // amount of the latest charge; drives annualDrain, the card and the Blood Meter
  occurrences: number;
  lastChargeDate: string;
  nextExpectedDate: string;
  annualDrain: Paise;
  confidence: number;      // 0..1
  possiblyCancelled: boolean;
  priceChange?: PriceChange;
  transactionDates: string[];
}

export type Decision = 'undecided' | 'keep' | 'stake' | 'dismiss';

export interface ParseResult {
  transactions: Transaction[];
  skippedRows: number;
  needsMapping: boolean;           // true if columns could not be detected
  headers?: string[];              // for the column mapper
  rawRows?: string[][];
}
```

### Cadence constants
| Cadence | Gap window (days) | Min occurrences | Periods/year | `NEXT_DATE_RULE` | `CANCELLED_AFTER_DAYS` |
|---|---|---|---|---|---|
| weekly | 6-8 | 3 | 52 | last + 7 days | 10.5 |
| every28days | 27-29 | 3 | 13 | last + 28 days | 42 |
| monthly | 28-34 | 3 | 12 | same day next month, clamped to month end | 45 |
| quarterly | 85-95 | 3 | 4 | same day 3 months later, clamped | 136.5 |
| yearly | 350-380 | 2 | 1 | same day next year, clamped | 547.5 |

`CANCELLED_AFTER_DAYS` is 1.5 x the nominal period length (7, 28, 30, 91, 365 days). A vampire is possibly cancelled when `daysBetween(lastChargeDate, referenceDate) > CANCELLED_AFTER_DAYS[cadence]`.

## Modules

### `amounts.ts`
- `parseAmount(input: string): Paise | null` handles `1,23,456.78`, `Rs.`, `₹`, `INR`, spaces, parentheses, trailing `Dr`/`Cr`, and returns the absolute value.
- `parseSignedAmount(input: string): number | null` returns signed paise: a leading `-` or parentheses is negative. Used for the single signed amount column.
- `formatINR(p: Paise): string` returns e.g. `₹1,23,456.78` with Indian grouping. All UI text and exports use `₹`, never "Rs".

### `dates.ts`
- `parseDate(input: string): string | null` returns `YYYY-MM-DD`. Numeric forms are day-first. Two-digit years 00-79 map to 20xx and 80-99 to 19xx. Validates real calendar dates (rejects 31/02).
- `addDays(date, n)`, `addMonths(date, n)` (day-of-month clamped to the end of the target month, e.g. 31 Jan + 1 month = 28/29 Feb), `daysBetween(a, b)` using UTC math.

### `parseStatement.ts`
- Uses papaparse (`header: false`, skipEmptyLines) to get raw rows.
- `validateFile(name, size, text): 'not-csv' | 'empty' | 'too-large' | null` rejects non-`.csv` names, empty content, and files over 10 MB (10 * 1024 * 1024 bytes) before parsing.
- **Header detection:** the first row containing a date-like header AND a narration-like header (matches /date/i and /narration|description|particulars|details|remarks/i). Rows above are discarded as preamble.
- **Column detection:**
  - date: header matches /^(txn|transaction|value)?\s*date/i (prefer "Date" over "Value Dt")
  - narration: /narration|description|particulars|details|remarks/i
  - debit: /withdrawal|debit|dr\b/i ; credit: /deposit|credit|cr\b/i
  - or single amount column + optional Dr/Cr indicator column
- **Direction:** separate withdrawal/deposit columns decide by which is filled. A Dr/Cr marker decides by the marker. A single signed amount column uses the sign: negative = debit, positive = credit.
- If date, narration, and at least one amount source are found, parse. Otherwise return `needsMapping: true`.
- `applyMapping(rawRows, headers, mapping): ParseResult` for manual mapping. `mapping` is `{ date, narration, amount, flipSign }`. The amount column is read as a signed amount (negative = debit). With `flipSign: true`, positive = debit and negative = credit. A debit-only column therefore needs "Flip sign" on.

### `normalizeMerchant.ts`
- `normalizeMerchant(narration: string): { key: string; display: string }`
- Steps: uppercase -> strip bank prefixes (`UPI-`, `UPI/`, `ACH D-`, `ACH/`, `NACH`, `ECS`, `POS`, `AUTOPAY`, `IMPS`, `NEFT`) -> strip UPI handles as whole tokens (`9876@oksbi`, `spotify@ybl`, `...@okaxis`) -> strip digit runs of 6 or more digits (shorter tokens such as `ZEE5`, `365`, `1MG` are kept) -> collapse whitespace -> trim punctuation -> check alias table (`merchantAliases.ts`) -> else use first 2-3 meaningful words as key.
- `key` is always the uppercase canonical string (for an alias, the uppercased canonical name such as `NETFLIX`). `display` is separate: the canonical name for an alias, otherwise the key in title case.
- Must be idempotent: `normalize(normalize(x).key).key === normalize(x).key`. Every alias pattern list must therefore match its own uppercased canonical name.

### `merchantAliases.ts`
Ordered array of `{ canonical, category, patterns: RegExp[] }` for ~30 popular services (Netflix, Amazon Prime, Disney+ Hotstar / JioHotstar, Spotify, YouTube Premium / Google YouTube, Google One / Google Storage, Apple (iCloud), Microsoft 365, ChatGPT / OpenAI, Anthropic, Notion, Canva, Adobe, LinkedIn, Zomato Gold, Swiggy One, Cult.fit, Audible, Sony LIV, Zee5, Jio, Airtel, Vi).
- **Order is specific-first; the first match wins.** JioHotstar comes before Jio. Amazon Prime comes before any generic Amazon entry, and "Amazon Pay" must not match Amazon Prime.
- Categories: Spotify and YouTube Premium are both `music`. Netflix, Hotstar, Prime, Sony LIV and Zee5 are `ott-video`. Google One and iCloud are `cloud`.
- A merchant is tier 1 (`subscription`) exactly when an alias matched.
- Verify real narration patterns against typical statements when writing.

### `detectRecurring.ts`
`detectRecurring(txns: Transaction[]): Vampire[]`

Algorithm:
1. Reference date = latest `date` across all transactions (credits included).
2. Keep debits. Attach `key`/`display`/`category`/`tier` via `normalizeMerchant`.
3. Group by key. Sort each group by date. Collapse same-day entries at one merchant into one occurrence that keeps the largest amount.
4. For each group, for each cadence with enough occurrences (3, or 2 for yearly):
   - gaps = consecutive day differences.
   - share = fraction of gaps inside the cadence window. The cadence fits if share >= 0.7 (with 2 gaps, both must fit; with 1 gap, it must fit).
5. If no cadence fits, skip the group. If both `every28days` and `monthly` fit, choose `every28days` only when at least 70% of gaps are exactly 28 and none exceeds 29; otherwise choose `monthly`. (Other windows do not overlap, so at most one other cadence fits.)
6. Amount stability, in date order:
   - runs: start a new run when an amount is not within 10% of the first amount of the current run. Stable if runs <= 2.
   - or amountShare = share of amounts within 10% of the median; stable if amountShare >= 0.7.
   - Skip the group if neither holds.
7. Compute: currentAmount = amount of the latest occurrence, lastChargeDate, nextExpectedDate = `NEXT_DATE_RULE[cadence]` applied to the last charge date, annualDrain = currentAmount x periodsPerYear. The median (even count rounded half up, `floor((a+b+1)/2)`) is used only in the stability check of step 6 and in the confidence formula.
8. Price change: build runs as in step 6. If there are at least 2 runs, compare the last amount of the previous run (`from`) with currentAmount (`to`); if `abs(to - from) / from > 0.05`, set `priceChange` with `direction` `hike` (higher) or `drop` (lower). With one run there is no price change.
9. possiblyCancelled = `daysBetween(lastChargeDate, referenceDate) > CANCELLED_AFTER_DAYS[cadence]`.
10. Confidence = clamp(0.4*regularity + 0.3*amountShare + 0.2*min(n/6, 1) + 0.1*(tier === 'subscription' ? 1 : 0)), where regularity = the share of gaps inside the chosen window. Yearly detections cap confidence at 0.6.
11. Return sorted by annualDrain descending, ties by merchant name ascending (code-point order).

Properties the implementation must satisfy are listed below.

### `savings.ts`
- A vampire is **eligible** when it is not `possiblyCancelled` and is either tier `subscription` or its key is in the `counted` set.
- `totals(vampires, decisions, counted)` returns `{ monthlyDrain, yearlyDrain, savedPerYear, toReview }`, computed over eligible vampires only:
  - `yearlyDrain` = sum of annualDrain where the decision is `undecided` or `keep`.
  - `savedPerYear` = sum of annualDrain where the decision is `stake`.
  - dismissed vampires count toward neither.
  - `monthlyDrain` = round half up of `yearlyDrain / 12`.
  - `toReview` = number of eligible vampires with decision `undecided`.
- `flagDuplicates(vampires, decisions, counted)` groups eligible, non-dismissed vampires by category (music, ott-video, cloud) and returns categories with 2+ vampires. Staked vampires still count.

### `cancelGuides.ts`
`Record<string, { steps: string[]; url?: string; lastVerified: string }>` keyed by canonical merchant, plus `genericGuide`. Steps are short, neutral, and must carry a `lastVerified` date. Only include steps that were verified from the provider's own help page.

## UI components (`src/ui/components/`)
- `UploadZone`: drag and drop plus file picker plus "Try with sample data". Shows errors from `validateFile` (not a CSV, empty, over 10 MB).
- `SkippedRowsNotice`: "N rows skipped" shown after parsing when `skippedRows > 0`.
- `ColumnMapper`: three dropdowns (date, narration, amount) plus a "Flip sign" toggle, shown only when needed.
- `BloodMeter`: circular gauge, animated fill, shows yearly drain and monthly equivalent. Has a text alternative for screen readers.
- `VampireCard`: merchant, cadence badge, current amount, next charge, price-hike or price-drop badge, duplicate badge, "Possibly cancelled" badge, cancel guide. The guide is expanded automatically when the vampire is staked; on every other card it sits behind a "How to cancel" toggle (a button with `aria-expanded`).
  - Counted cards: Keep / Stake / Dismiss / Undo.
  - Uncounted Other recurring cards: Count it / Dismiss / Undo.
- `VampireList`: "Subscriptions" section first, then "Other recurring payments (n)" collapsed by default, then "Dismissed (n)" collapsed by default.
- `SavingsBanner`: "You staked N vampires and saved ₹X a year".
- `PrivacyBadge`, `ExportButton` (disabled when nothing is staked; downloads `stake-list.md` as Markdown via an object URL), `ClearDataButton` (dispatches a reset to the initial state and revokes any export object URLs), `EmptyState` ("No vampires found").

State: a single `useReducer` in `App.tsx` holding `{ stage, transactions, vampires, decisions, counted, skippedRows }`. Nothing is persisted; a page refresh clears everything by design.

## Privacy and delivery
- "Clear all data" resets state to its initial value and revokes export object URLs (`URL.revokeObjectURL`).
- Fonts are self-hosted with `@fontsource/cinzel` and `@fontsource-variable/inter`. No Google Fonts or other third-party requests.
- A Content Security Policy with `connect-src 'self'` is set (meta tag in `index.html`, or host headers).
- The sample CSV is a bundled static asset. Loading it sends no statement data.

## Correctness properties (property-based tests)
- P1 `parseAmount(formatForParse(x)) == x` for any non-negative integer paise across plain, comma, Indian-grouped, and symbol-prefixed formats.
- P2 `parseDate` round-trips: any valid date rendered in each supported format parses back to the same ISO date. For `DD/MM/YY` the generator is limited to years 1980-2079.
- P3 `parseDate` rejects impossible dates (e.g. day 30/31 of the wrong month).
- P4 `normalizeMerchant` is idempotent.
- P5 `normalizeMerchant` ignores reference numbers: the same merchant with different random digit suffixes of 6 or more digits yields the same key. A separate example test checks that short tokens (`ZEE5`, `365`, `1MG`) are kept.
- P6 `detectRecurring` is order-independent: shuffling the input yields the same output, including sort order.
- P7 A generated monthly series (n >= 3 charges, fixed day-of-month 1-28, same amount) is always detected as `monthly`.
- P7b A generated monthly series (n >= 6 charges, base day-of-month 2-27, each charge shifted by at most +-1 day, same amount) is always detected as `monthly`.
- P8 A merchant whose consecutive gaps are all drawn from values outside every cadence window (1-5, 9-26, 35-84, 96-349, 381+ days) is never detected, for any number of charges.
- P9 Adding unrelated one-off noise transactions does not remove or change an already detected vampire. Noise is single debits with keys distinct from all existing keys, dated no later than the latest date in the original input (so the reference date does not move).
- P10 `annualDrain == currentAmount * periodsPerYear`, where `currentAmount` is the amount of the latest occurrence, and `annualDrain` is never negative.
- P11 `totals`: `savedPerYear + yearlyDrain` equals the sum of annualDrain over eligible, non-dismissed vampires, for any decision assignment and any `counted` set.

## Error handling
- Parse failures return structured results (`skippedRows`, `needsMapping`), never throw into the UI.
- The UI shows a toast or inline error for non-CSV, empty, or oversized files (limit 10 MB), using `validateFile`.

## Testing strategy
- Vitest example tests with realistic narrations per bank style (HDFC-like, SBI-like, ICICI-like column layouts). The sample CSV (`data/sample-statement.csv`) covers HDFC. Synthetic SBI-like and ICICI-like fixtures live in `tests/fixtures/` as `sbi-style.csv` and `icici-style.csv` (created in Task 3).
- fast-check property tests for P1-P11 (including P7b).
- Manual check: sample CSV yields the expected vampires and tiers listed in `data/README.md`.
- UI tasks (7-9) pass when their manual checklist is fully ticked: keyboard-only use, visible focus, 360px width, reduced motion, and AA contrast where relevant.
