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

export interface PriceChange { from: Paise; to: Paise; }

export interface Vampire {
  merchant: string;        // canonical display name
  key: string;             // normalised key
  category: string;        // e.g. 'ott-video', 'music', 'fitness', 'cloud', 'telecom', 'other'
  cadence: Cadence;
  typicalAmount: Paise;    // median
  occurrences: number;
  lastChargeDate: string;
  nextExpectedDate: string;
  annualDrain: Paise;
  confidence: number;      // 0..1
  priceChange?: PriceChange;
  transactionDates: string[];
}

export type Decision = 'undecided' | 'keep' | 'stake';

export interface ParseResult {
  transactions: Transaction[];
  skippedRows: number;
  needsMapping: boolean;           // true if columns could not be detected
  headers?: string[];              // for the column mapper
  rawRows?: string[][];
}
```

## Modules

### `amounts.ts`
- `parseAmount(input: string): Paise | null` handles `1,23,456.78`, `Rs.`, `₹`, `INR`, spaces, parentheses, trailing `Dr`/`Cr` (returns absolute value; direction is decided elsewhere).
- `formatINR(p: Paise): string` returns e.g. `₹1,23,456.78` with Indian grouping.

### `dates.ts`
- `parseDate(input: string): string | null` returns `YYYY-MM-DD`. Numeric forms are day-first. Validates real calendar dates (rejects 31/02).
- `addDays(date, n)`, `daysBetween(a, b)` using UTC math.

### `parseStatement.ts`
- Uses papaparse (`header: false`, skipEmptyLines) to get raw rows.
- **Header detection:** the first row containing a date-like header AND a narration-like header (matches /date/i and /narration|description|particulars|details|remarks/i). Rows above are discarded as preamble.
- **Column detection:**
  - date: header matches /^(txn|transaction|value)?\s*date/i (prefer "Date" over "Value Dt")
  - narration: /narration|description|particulars|details|remarks/i
  - debit: /withdrawal|debit|dr\b/i ; credit: /deposit|credit|cr\b/i
  - or single amount column + optional Dr/Cr indicator column
- If date, narration, and at least one amount source are found, parse. Otherwise return `needsMapping: true`.
- `applyMapping(rawRows, headers, mapping): ParseResult` for manual mapping.

### `normalizeMerchant.ts`
- `normalizeMerchant(narration: string): { key: string; display: string }`
- Steps: uppercase -> strip bank prefixes (`UPI-`, `UPI/`, `ACH D-`, `ACH/`, `NACH`, `ECS`, `POS`, `AUTOPAY`, `IMPS`, `NEFT`) -> strip long digit runs and reference ids -> strip UPI handle suffixes (`@ybl`, `@okaxis`, etc.) -> collapse whitespace -> trim punctuation -> check alias table (`merchantAliases.ts`) -> else use first 2-3 meaningful words as key.
- Must be idempotent: `normalize(normalize(x).key).key === normalize(x).key`.

### `merchantAliases.ts`
Array of `{ canonical, category, patterns: RegExp[] }` for ~30 popular services (Netflix, Amazon Prime, Disney+ Hotstar / JioHotstar, Spotify, YouTube Premium / Google YouTube, Google One / Google Storage, Apple (iCloud), Microsoft 365, ChatGPT / OpenAI, Anthropic, Notion, Canva, Adobe, LinkedIn, Zomato Gold, Swiggy One, Cult.fit, Audible, Sony LIV, Zee5, Jio, Airtel, Vi). Verify real narration patterns against typical statements when writing.

### `detectRecurring.ts`
`detectRecurring(txns: Transaction[]): Vampire[]`

Algorithm:
1. Keep debits. Attach `key`/`display`/`category` via `normalizeMerchant`.
2. Group by key. Sort each group by date. Merge duplicate same-day entries of the same amount (treat as one).
3. For groups with n >= 3 (or n >= 2 for the yearly case):
   - gaps = consecutive day differences.
   - For each cadence window, count the share of gaps inside the window. Choose the cadence with the highest share. Require share >= 0.7. Ties: prefer the narrower window.
   - amountOk = share of amounts within +-10% of the median >= 0.7.
4. Compute: typicalAmount = median, lastChargeDate, nextExpectedDate = last + median gap for the chosen cadence, annualDrain = typicalAmount x periodsPerYear (weekly 52, every28days 13, monthly 12, quarterly 4, yearly 1).
5. Price change: compare last amount vs the median of earlier amounts; if relative diff > 5%, set `priceChange`.
6. Confidence = clamp(0.4*regularity + 0.3*amountStability + 0.2*min(n/6, 1) + 0.1*(knownMerchant ? 1 : 0)). Yearly detections cap confidence at 0.6.
7. Return sorted by annualDrain descending.

Properties the implementation must satisfy are listed below.

### `savings.ts`
- `totals(vampires, decisions)` returns `{ monthlyDrain, yearlyDrain, savedPerYear, toReview }`.
- Only **staked** vampires are removed from the drain; undecided and kept vampires stay in. `savedPerYear` = sum of staked annualDrain.
- `monthlyDrain = round(yearlyDrain / 12)`.
- `flagDuplicates(vampires)` groups by category (music, ott-video, cloud) and returns categories with 2+ vampires.

### `cancelGuides.ts`
`Record<string, { steps: string[]; url?: string; lastVerified: string }>` keyed by canonical merchant, plus `genericGuide`. Steps are short, neutral, and must carry a `lastVerified` date. Only include steps that were verified from the provider's own help page.

## UI components (`src/ui/components/`)
- `UploadZone`: drag and drop plus file picker plus "Try with sample data".
- `ColumnMapper`: three dropdowns (date, narration, amount/debit) shown only when needed.
- `BloodMeter`: circular gauge, animated fill, shows yearly drain and monthly equivalent.
- `VampireCard`: merchant, cadence badge, amount, next charge, price-hike badge, Keep / Stake buttons, expandable cancel guide.
- `SavingsBanner`: "You staked N vampires and saved Rs X a year".
- `PrivacyBadge`, `ExportButton`, `ClearDataButton`, `EmptyState`.

State: a single `useReducer` in `App.tsx` holding `{ stage, transactions, vampires, decisions, skippedRows }`.

## Correctness properties (property-based tests)
- P1 `parseAmount(formatForParse(x)) == x` for any non-negative integer paise across plain, comma, Indian-grouped, and symbol-prefixed formats.
- P2 `parseDate` round-trips: any valid date rendered in each supported format parses back to the same ISO date.
- P3 `parseDate` rejects impossible dates (e.g. day 30/31 of the wrong month).
- P4 `normalizeMerchant` is idempotent.
- P5 `normalizeMerchant` ignores reference numbers: the same merchant with different random digit suffixes yields the same key.
- P6 `detectRecurring` is order-independent: shuffling the input yields the same output.
- P7 A generated monthly series (n >= 3 charges, each day-of-month shifted by at most 2 days, same amount) is always detected as `monthly`.
- P8 A single transaction (or any merchant with all gaps irregular, e.g. random gaps 1-200 days) is never detected.
- P9 Adding unrelated one-off noise transactions does not remove or change an already detected vampire.
- P10 `annualDrain == typicalAmount * periodsPerYear` and is never negative.
- P11 `totals`: `savedPerYear + yearlyDrain == sum of all annualDrain`, for any decision assignment (staked removed from drain, all others kept).

## Error handling
- Parse failures return structured results (`skippedRows`, `needsMapping`), never throw into the UI.
- The UI shows a toast or inline error for non-CSV, empty, or oversized files (limit 10 MB).

## Testing strategy
- Vitest example tests with realistic narrations per bank style (HDFC-like, SBI-like, ICICI-like column layouts).
- fast-check property tests for P1-P11.
- Manual check: sample CSV yields the expected vampires listed in `data/README.md`.
