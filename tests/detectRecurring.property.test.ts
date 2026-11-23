import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays, addMonths } from '../src/core/dates';
import { PERIODS_PER_YEAR, detectRecurring } from '../src/core/detectRecurring';
import { normalizeMerchant } from '../src/core/normalizeMerchant';
import { parseStatement } from '../src/core/parseStatement';
import type { Transaction } from '../src/core/types';

// ---------------------------------------------------------------------------
// Shared generators
// ---------------------------------------------------------------------------

/** Merchant names used to build narrations. Each gives a different key; known and unknown merchants are mixed. */
const NAMES = [
  'NETFLIX COM', 'SPOTIFY INDIA', 'GOOGLE ONE', 'CULT FIT', 'JIO PREPAID RECHARGE', 'BHARTI AIRTEL',
  'YOUTUBE PREMIUM', 'LANDLORD RAMESH', 'HOUSE RENT', 'FRESH MILK DAIRY', 'CORNER STORE', 'CITY GYM',
  'BOOK CLUB', 'PET CARE', 'WATER CAN', 'TUITION FEES',
];

const narration = (name: string, ref: number): string => `UPI-${name}-${String(100000 + ref)}@ybl`;
const debit = (date: string, name: string, amount: number, ref: number): Transaction => ({
  date,
  narration: narration(name, ref),
  amount,
  direction: 'debit',
});

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** Month `i` after (year, month), as [year, month], without using the code under test. */
function monthAfter(year: number, month: number, i: number): [number, number] {
  const total = year * 12 + (month - 1) + i;
  return [Math.floor(total / 12), (total % 12) + 1];
}

/** Day arithmetic on ISO dates (UTC), independent of src/core/dates.ts. */
function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const date = new Date(t);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

type GapMode = 'weekly' | 'every28' | 'monthly' | 'quarterly' | 'yearly' | 'random';
type AmountMode = 'constant' | 'priceChange' | 'noisy' | 'wild';

/** One merchant's charges: a regular or irregular series with various amount patterns, same-day extras and a credit. */
function scenario(name: string): fc.Arbitrary<Transaction[]> {
  const fourteen = <T>(arb: fc.Arbitrary<T>) => fc.array(arb, { minLength: 14, maxLength: 14 });
  return fc
    .record({
      start: fc.integer({ min: 0, max: 1500 }),
      count: fc.integer({ min: 1, max: 14 }),
      gapMode: fc.constantFrom<GapMode>('weekly', 'every28', 'monthly', 'quarterly', 'yearly', 'random'),
      jitter: fourteen(fc.integer({ min: -1, max: 1 })),
      randomGaps: fourteen(fc.integer({ min: 1, max: 200 })),
      base: fc.integer({ min: 100, max: 5_000_000 }),
      amountMode: fc.constantFrom<AmountMode>('constant', 'priceChange', 'noisy', 'wild'),
      changeAt: fc.integer({ min: 1, max: 13 }),
      percent: fourteen(fc.integer({ min: -15, max: 15 })),
      wild: fourteen(fc.integer({ min: 100, max: 5_000_000 })),
      sameDayExtra: fc.option(fc.tuple(fc.integer({ min: 0, max: 13 }), fc.integer({ min: 1, max: 5_000_000 })), {
        nil: undefined,
      }),
      credit: fc.boolean(),
    })
    .map((s) => {
      const first = addDays('2020-01-01', s.start);
      const dates: string[] = [];
      let cursor = first;
      for (let i = 0; i < s.count; i += 1) {
        if (s.gapMode === 'monthly') {
          dates.push(addDays(addMonths(first, i), s.jitter[i] as number));
          continue;
        }
        if (i > 0) {
          const step =
            s.gapMode === 'weekly' ? 7 + (s.jitter[i] as number)
            : s.gapMode === 'every28' ? 28
            : s.gapMode === 'quarterly' ? 91 + 3 * (s.jitter[i] as number)
            : s.gapMode === 'yearly' ? 365 + 5 * (s.jitter[i] as number)
            : (s.randomGaps[i] as number);
          cursor = addDays(cursor, step);
        }
        dates.push(cursor);
      }
      const amountAt = (i: number): number =>
        s.amountMode === 'constant' ? s.base
        : s.amountMode === 'priceChange' ? (i < s.changeAt ? s.base : Math.round(s.base * 1.2))
        : s.amountMode === 'noisy' ? s.base + Math.floor((s.base * (s.percent[i] as number)) / 100)
        : (s.wild[i] as number);

      const txns = dates.map((date, i) => debit(date, name, amountAt(i), s.start + i * 7919));
      if (s.sameDayExtra && s.sameDayExtra[0] < dates.length) {
        txns.push(debit(dates[s.sameDayExtra[0]] as string, name, s.sameDayExtra[1], 999_999));
      }
      if (s.credit) txns.push({ date: dates[0] as string, narration: narration(name, 1), amount: s.base, direction: 'credit' });
      return txns;
    });
}

/** A statement: up to 6 different merchants, each with its own scenario. */
const statement: fc.Arbitrary<Transaction[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: NAMES.length - 1 }), { maxLength: 6 })
  .chain(
    (ids): fc.Arbitrary<Transaction[][]> =>
      ids.length === 0 ? fc.constant<Transaction[][]>([]) : fc.tuple(...ids.map((i) => scenario(NAMES[i] as string))),
  )
  .map((parts) => parts.flat());

const SAMPLE = parseStatement(readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8')).transactions;

// ---------------------------------------------------------------------------
// P6
// ---------------------------------------------------------------------------

describe('P6: detectRecurring is order-independent', () => {
  it('shuffling the input yields the same output, including sort order', () => {
    let nonEmpty = 0;
    const runs = 1000;
    fc.assert(
      fc.property(
        statement.chain((txns) => fc.tuple(fc.constant(txns), fc.shuffledSubarray(txns, { minLength: txns.length }))),
        ([txns, shuffled]) => {
          const original = detectRecurring(txns);
          if (original.length > 0) nonEmpty += 1;
          expect(detectRecurring(shuffled)).toEqual(original);
        },
      ),
      { numRuns: runs },
    );
    // The generator must produce detections often, or the property says little.
    expect(nonEmpty).toBeGreaterThan(runs * 0.3);
  });

  it('shuffling the sample statement yields the same output', () => {
    const expected = detectRecurring(SAMPLE);
    expect(expected.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(fc.shuffledSubarray(SAMPLE, { minLength: SAMPLE.length }), (shuffled) => {
        expect(detectRecurring(shuffled)).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P7 and P7b
// ---------------------------------------------------------------------------

const nameArb = fc.constantFrom(...NAMES);

describe('P7: a monthly series on a fixed day-of-month is always detected as monthly', () => {
  it('n >= 3 charges, fixed day-of-month 1-28, same amount -> one vampire, cadence monthly', () => {
    fc.assert(
      fc.property(
        nameArb,
        fc.integer({ min: 1990, max: 2070 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 3, max: 36 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (name, year, month, day, n, amount) => {
          const txns = Array.from({ length: n }, (_, i) => {
            const [y, m] = monthAfter(year, month, i);
            return debit(`${pad(y, 4)}-${pad(m)}-${pad(day)}`, name, amount, i);
          });
          const result = detectRecurring(txns);
          expect(result).toHaveLength(1);
          expect(result[0]?.cadence).toBe('monthly');
        },
      ),
      { numRuns: 2000 },
    );
  });
});

describe('P7b: a monthly series with +-1 day jitter is always detected as monthly', () => {
  it('n >= 6 charges, base day-of-month 2-27, each shifted by at most +-1 day, same amount -> one vampire, cadence monthly', () => {
    fc.assert(
      fc.property(
        nameArb,
        fc.integer({ min: 1990, max: 2070 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2, max: 27 }),
        fc.array(fc.integer({ min: -1, max: 1 }), { minLength: 6, maxLength: 36 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (name, year, month, day, shifts, amount) => {
          const txns = shifts.map((shift, i) => {
            const [y, m] = monthAfter(year, month, i);
            const d = day + shift; // 1..28, always a real day
            return debit(`${pad(y, 4)}-${pad(m)}-${pad(d)}`, name, amount, i);
          });
          const result = detectRecurring(txns);
          expect(result).toHaveLength(1);
          expect(result[0]?.cadence).toBe('monthly');
        },
      ),
      { numRuns: 2000 },
    );
  });
});

// ---------------------------------------------------------------------------
// P8
// ---------------------------------------------------------------------------

/** Gaps outside every cadence window: 1-5, 9-26, 35-84, 96-349, 381+ days. */
const gapOutsideEveryWindow = fc.oneof(
  fc.integer({ min: 1, max: 5 }),
  fc.integer({ min: 9, max: 26 }),
  fc.integer({ min: 35, max: 84 }),
  fc.integer({ min: 96, max: 349 }),
  fc.integer({ min: 381, max: 3000 }),
);

describe('P8: a merchant with every gap outside every cadence window is never detected', () => {
  it('for any number of charges and any amounts, nothing is detected', () => {
    fc.assert(
      fc.property(
        nameArb,
        fc.integer({ min: 0, max: 20_000 }),
        fc.array(gapOutsideEveryWindow, { maxLength: 30 }),
        fc.array(fc.integer({ min: 1, max: 10_000_000 }), { minLength: 31, maxLength: 31 }),
        fc.boolean(),
        (name, startOffset, gaps, amounts, sameAmount) => {
          let date = shiftDays('1990-01-01', startOffset);
          const txns = [debit(date, name, amounts[0] as number, 0)];
          gaps.forEach((gap, i) => {
            date = shiftDays(date, gap);
            txns.push(debit(date, name, sameAmount ? (amounts[0] as number) : (amounts[i + 1] as number), i + 1));
          });
          expect(detectRecurring(txns)).toEqual([]);
        },
      ),
      { numRuns: 3000 },
    );
  });
});

// ---------------------------------------------------------------------------
// P9
// ---------------------------------------------------------------------------

/** Distinct letter-only tags (A, B, ..., Z, BA, BB, ...) so every noise merchant has its own key. */
function tag(i: number): string {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  } while (n > 0);
  return s;
}

describe('P9: unrelated one-off noise does not remove or change a detected vampire', () => {
  it('adding single debits with new keys, dated no later than the latest input date, keeps every vampire unchanged', () => {
    let checked = 0;
    const noise = fc.array(
      fc.record({ back: fc.integer({ min: 0, max: 2000 }), amount: fc.integer({ min: 1, max: 10_000_000 }) }),
      { minLength: 1, maxLength: 15 },
    );
    fc.assert(
      fc.property(statement, noise, (txns, extra) => {
        fc.pre(txns.length > 0);
        const latest = txns.reduce((max, t) => (t.date > max ? t.date : max), txns[0]?.date ?? '');
        const existingKeys = new Set(txns.map((t) => normalizeMerchant(t.narration).key));
        const noiseTxns = extra.map((e, i) => debit(addDays(latest, -e.back), `NOISE${tag(i)} SHOP`, e.amount, i));

        // Preconditions of P9: one debit per new key, all keys new, reference date unchanged.
        const noiseKeys = noiseTxns.map((t) => normalizeMerchant(t.narration).key);
        expect(new Set(noiseKeys).size).toBe(noiseTxns.length);
        expect(noiseKeys.some((k) => existingKeys.has(k))).toBe(false);
        expect(noiseTxns.every((t) => t.date <= latest)).toBe(true);

        const before = detectRecurring(txns);
        const after = detectRecurring([...txns, ...noiseTxns]);
        if (before.length > 0) checked += 1;
        for (const vampire of before) expect(after).toContainEqual(vampire);
      }),
      { numRuns: 1000 },
    );
    expect(checked).toBeGreaterThan(300);
  });
});

// ---------------------------------------------------------------------------
// P10
// ---------------------------------------------------------------------------

describe('P10: annualDrain is currentAmount x periods per year and never negative', () => {
  it('annualDrain == currentAmount * periodsPerYear, currentAmount is the latest occurrence, annualDrain >= 0', () => {
    let checked = 0;
    fc.assert(
      fc.property(statement, (txns) => {
        for (const v of detectRecurring(txns)) {
          checked += 1;
          expect(v.annualDrain).toBe(v.currentAmount * PERIODS_PER_YEAR[v.cadence]);
          expect(v.annualDrain).toBeGreaterThanOrEqual(0);
          expect(Number.isSafeInteger(v.annualDrain)).toBe(true);

          // currentAmount is the latest occurrence: the largest debit on the latest debit date for this key.
          const own = txns.filter((t) => t.direction === 'debit' && normalizeMerchant(t.narration).key === v.key);
          const lastDate = own.reduce((max, t) => (t.date > max ? t.date : max), '');
          expect(v.lastChargeDate).toBe(lastDate);
          expect(v.currentAmount).toBe(Math.max(...own.filter((t) => t.date === lastDate).map((t) => t.amount)));
        }
      }),
      { numRuns: 1500 },
    );
    expect(checked).toBeGreaterThan(500);
  });
});
