import { addDays, addMonths, daysBetween } from './dates';
import { normalizeMerchant } from './normalizeMerchant';
import type { Cadence, Paise, PriceChange, Transaction, Vampire } from './types';

/** Inclusive gap windows, in days between consecutive occurrences (Req 4.2). */
export const CADENCE_WINDOWS: Readonly<Record<Cadence, { min: number; max: number }>> = {
  weekly: { min: 6, max: 8 },
  every28days: { min: 27, max: 29 },
  monthly: { min: 28, max: 34 },
  quarterly: { min: 85, max: 95 },
  yearly: { min: 350, max: 380 },
};

/** Occurrences needed before a cadence is considered (Req 4.3). */
export const MIN_OCCURRENCES: Readonly<Record<Cadence, number>> = {
  weekly: 3,
  every28days: 3,
  monthly: 3,
  quarterly: 3,
  yearly: 2,
};

export const PERIODS_PER_YEAR: Readonly<Record<Cadence, number>> = {
  weekly: 52,
  every28days: 13,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

/** Next expected charge from the last charge date (Req 4.12). Month steps are clamped to the month end. */
export const NEXT_DATE_RULE: Readonly<Record<Cadence, (lastChargeDate: string) => string>> = {
  weekly: (d) => addDays(d, 7),
  every28days: (d) => addDays(d, 28),
  monthly: (d) => addMonths(d, 1),
  quarterly: (d) => addMonths(d, 3),
  yearly: (d) => addMonths(d, 12),
};

/** 1.5 x the nominal period (7, 28, 30, 91, 365 days) (Req 4.10). */
export const CANCELLED_AFTER_DAYS: Readonly<Record<Cadence, number>> = {
  weekly: 10.5,
  every28days: 42,
  monthly: 45,
  quarterly: 136.5,
  yearly: 547.5,
};

const CADENCES: readonly Cadence[] = ['weekly', 'every28days', 'monthly', 'quarterly', 'yearly'];

/** Yearly detections are capped at this confidence (Req 4.11). */
const YEARLY_CONFIDENCE_CAP = 0.6;

interface Occurrence {
  date: string;
  amount: Paise;
}

interface Group {
  key: string;
  display: string;
  category: string;
  known: boolean;
  /** Largest debit per day, keyed by date. */
  byDate: Map<string, Paise>;
}

/** `count / total >= 0.7`, in integers so no float rounding can flip the result. */
const atLeast70Percent = (count: number, total: number): boolean => total > 0 && count * 10 >= total * 7;

/** `a` is within 10% of `base`. */
const within10Percent = (a: Paise, base: Paise): boolean => Math.abs(a - base) * 10 <= base;

const inWindow = (gap: number, cadence: Cadence): boolean =>
  gap >= CADENCE_WINDOWS[cadence].min && gap <= CADENCE_WINDOWS[cadence].max;

/** Median in whole paise; even counts round half up (Req 4.13). */
function median(amounts: readonly Paise[]): Paise {
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as Paise;
  const a = sorted[mid - 1] as Paise;
  const b = sorted[mid] as Paise;
  return Math.floor((a + b + 1) / 2);
}

/** Splits amounts (in date order) into runs: a new run starts when an amount is not within 10% of the run's first amount. */
function toRuns(amounts: readonly Paise[]): Paise[][] {
  const runs: Paise[][] = [];
  for (const amount of amounts) {
    const current = runs[runs.length - 1];
    if (current && within10Percent(amount, current[0] as Paise)) current.push(amount);
    else runs.push([amount]);
  }
  return runs;
}

/** Picks the cadence for the gaps, or null. Applies the every-28-days vs monthly rule (Req 4.4). */
function chooseCadence(occurrenceCount: number, gaps: readonly number[]): Cadence | null {
  const fits = CADENCES.filter(
    (cadence) =>
      occurrenceCount >= MIN_OCCURRENCES[cadence] &&
      atLeast70Percent(gaps.filter((g) => inWindow(g, cadence)).length, gaps.length),
  );
  if (fits.includes('every28days') && fits.includes('monthly')) {
    const exactly28 = gaps.filter((g) => g === 28).length;
    const noneAbove29 = gaps.every((g) => g <= 29);
    return atLeast70Percent(exactly28, gaps.length) && noneAbove29 ? 'every28days' : 'monthly';
  }
  // The remaining windows do not overlap, so at most one cadence is left.
  return fits[0] ?? null;
}

function priceChangeOf(runs: readonly Paise[][], currentAmount: Paise): PriceChange | undefined {
  if (runs.length < 2) return undefined;
  const previousRun = runs[runs.length - 2] as Paise[];
  const from = previousRun[previousRun.length - 1] as Paise;
  const to = currentAmount;
  if (Math.abs(to - from) * 20 <= from) return undefined; // not more than 5%
  return { from, to, direction: to > from ? 'hike' : 'drop' };
}

function analyse(group: Group, referenceDate: string): Vampire | null {
  const occurrences: Occurrence[] = [...group.byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const n = occurrences.length;

  const gaps: number[] = [];
  for (let i = 1; i < n; i += 1) {
    gaps.push(daysBetween((occurrences[i - 1] as Occurrence).date, (occurrences[i] as Occurrence).date));
  }

  const cadence = chooseCadence(n, gaps);
  if (cadence === null) return null;

  const amounts = occurrences.map((o) => o.amount);
  const runs = toRuns(amounts);
  const typical = median(amounts);
  const amountShareCount = amounts.filter((a) => within10Percent(a, typical)).length;
  const stable = runs.length <= 2 || atLeast70Percent(amountShareCount, n);
  if (!stable) return null;

  const last = occurrences[n - 1] as Occurrence;
  const currentAmount = last.amount;
  const regularity = gaps.filter((g) => inWindow(g, cadence)).length / gaps.length;
  const amountShare = amountShareCount / n;
  // 0.4*regularity + 0.3*amountShare + 0.2*min(n/6, 1) + 0.1*known, with the weights
  // summed as whole tenths so a perfect score is exactly 1 (0.4+0.3+0.2+0.1 is not, in floats).
  const raw = (4 * regularity + 3 * amountShare + 2 * Math.min(n / 6, 1) + (group.known ? 1 : 0)) / 10;
  const clamped = Math.min(1, Math.max(0, raw));
  const confidence = cadence === 'yearly' ? Math.min(clamped, YEARLY_CONFIDENCE_CAP) : clamped;

  const vampire: Vampire = {
    merchant: group.display,
    key: group.key,
    category: group.category,
    tier: group.known ? 'subscription' : 'other',
    cadence,
    currentAmount,
    occurrences: n,
    lastChargeDate: last.date,
    nextExpectedDate: NEXT_DATE_RULE[cadence](last.date),
    annualDrain: currentAmount * PERIODS_PER_YEAR[cadence],
    confidence,
    possiblyCancelled: daysBetween(last.date, referenceDate) > CANCELLED_AFTER_DAYS[cadence],
    transactionDates: occurrences.map((o) => o.date),
  };
  const priceChange = priceChangeOf(runs, currentAmount);
  if (priceChange) vampire.priceChange = priceChange;
  return vampire;
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Finds recurring debits ("vampires") in a statement.
 *
 * Only debits are analysed; the reference date (for "possibly cancelled") is the
 * latest date of any transaction, credits included. Debits are grouped by
 * merchant key; debits whose narration leaves no merchant key (key '') are not
 * grouped. Same-day debits at one merchant collapse into one occurrence that
 * keeps the largest amount. The result does not depend on input order and is
 * sorted by annual drain (highest first), then merchant name, then key.
 */
export function detectRecurring(txns: readonly Transaction[]): Vampire[] {
  if (txns.length === 0) return [];
  const referenceDate = txns.reduce((latest, t) => (t.date > latest ? t.date : latest), txns[0]?.date ?? '');

  const groups = new Map<string, Group>();
  for (const t of txns) {
    if (t.direction !== 'debit') continue;
    const merchant = normalizeMerchant(t.narration);
    if (merchant.key === '') continue;

    let group = groups.get(merchant.key);
    if (!group) {
      group = { ...merchant, byDate: new Map() };
      groups.set(merchant.key, group);
    } else if (merchant.known && !group.known) {
      // Keep the alias information whichever row comes first.
      group.display = merchant.display;
      group.category = merchant.category;
      group.known = true;
    }
    const existing = group.byDate.get(t.date);
    if (existing === undefined || t.amount > existing) group.byDate.set(t.date, t.amount);
  }

  const vampires: Vampire[] = [];
  for (const group of groups.values()) {
    const vampire = analyse(group, referenceDate);
    if (vampire) vampires.push(vampire);
  }
  return vampires.sort(
    (a, b) => b.annualDrain - a.annualDrain || compareText(a.merchant, b.merchant) || compareText(a.key, b.key),
  );
}
