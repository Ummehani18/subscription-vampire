import { describe, expect, it } from 'vitest';
import {
  CADENCE_WINDOWS,
  CANCELLED_AFTER_DAYS,
  MIN_OCCURRENCES,
  NEXT_DATE_RULE,
  PERIODS_PER_YEAR,
  detectRecurring,
} from '../src/core/detectRecurring';
import { addDays } from '../src/core/dates';
import type { Transaction } from '../src/core/types';

let refCounter = 0;
/** A debit at `name` with a fresh reference number each time, as in real statements. */
const debit = (date: string, name: string, amount: number): Transaction => ({
  date,
  narration: `UPI-${name}-${String(4_123_000_000 + (refCounter += 1))}@ybl`,
  amount,
  direction: 'debit',
});
const credit = (date: string, amount = 8_500_000): Transaction => ({
  date,
  narration: 'NEFT CR-ACME TECH PVT LTD-SALARY',
  amount,
  direction: 'credit',
});
/** Debits on the given dates; `amounts` is one amount for all, or one per date. */
const series = (name: string, dates: string[], amounts: number | number[]): Transaction[] =>
  dates.map((date, i) => debit(date, name, Array.isArray(amounts) ? (amounts[i] as number) : amounts));
/** Dates starting at `start`, separated by `gaps`. */
const datesFromGaps = (start: string, gaps: number[]): string[] =>
  gaps.reduce<string[]>((acc, gap) => [...acc, addDays(acc[acc.length - 1] as string, gap)], [start]);

const MONTHLY_6 = ['2026-05-12', '2026-06-12', '2026-07-12', '2026-08-12', '2026-09-13', '2026-10-13'];

describe('constants match the approved design', () => {
  it('gap windows', () => {
    expect(CADENCE_WINDOWS).toEqual({
      weekly: { min: 6, max: 8 },
      every28days: { min: 27, max: 29 },
      monthly: { min: 28, max: 34 },
      quarterly: { min: 85, max: 95 },
      yearly: { min: 350, max: 380 },
    });
  });

  it('minimum occurrences, periods per year and CANCELLED_AFTER_DAYS', () => {
    expect(MIN_OCCURRENCES).toEqual({ weekly: 3, every28days: 3, monthly: 3, quarterly: 3, yearly: 2 });
    expect(PERIODS_PER_YEAR).toEqual({ weekly: 52, every28days: 13, monthly: 12, quarterly: 4, yearly: 1 });
    expect(CANCELLED_AFTER_DAYS).toEqual({
      weekly: 10.5,
      every28days: 42,
      monthly: 45,
      quarterly: 136.5,
      yearly: 547.5,
    });
  });

  it('NEXT_DATE_RULE', () => {
    expect(NEXT_DATE_RULE.weekly('2026-12-28')).toBe('2027-01-04');
    expect(NEXT_DATE_RULE.every28days('2026-10-17')).toBe('2026-11-14');
    expect(NEXT_DATE_RULE.monthly('2026-10-05')).toBe('2026-11-05');
    expect(NEXT_DATE_RULE.quarterly('2026-10-05')).toBe('2027-01-05');
    expect(NEXT_DATE_RULE.yearly('2026-10-05')).toBe('2027-10-05');
  });
});

describe('price change and currentAmount', () => {
  it('Spotify-style 119 -> 139: currentAmount 139, annualDrain 139 x 12, price hike from 119', () => {
    const [v] = detectRecurring(series('SPOTIFY INDIA', MONTHLY_6, [11900, 11900, 11900, 11900, 13900, 13900]));
    expect(v).toMatchObject({
      merchant: 'Spotify',
      key: 'SPOTIFY',
      tier: 'subscription',
      category: 'music',
      cadence: 'monthly',
      currentAmount: 13900,
      annualDrain: 13900 * 12,
      priceChange: { from: 11900, to: 13900, direction: 'hike' },
    });
    expect(v?.annualDrain).toBe(166800);
  });

  it('a price drop (299 -> 149) is flagged as a drop and the drain uses the new price', () => {
    const [v] = detectRecurring(series('JIOHOTSTAR', MONTHLY_6, [29900, 29900, 29900, 29900, 14900, 14900]));
    expect(v).toMatchObject({
      key: 'JIOHOTSTAR',
      currentAmount: 14900,
      annualDrain: 14900 * 12,
      priceChange: { from: 29900, to: 14900, direction: 'drop' },
    });
  });

  it('one run of similar amounts has no price change; currentAmount is still the latest charge', () => {
    const [v] = detectRecurring(series('OPENAI CHATGPT', MONTHLY_6, [195000, 196200, 193800, 195000, 197100, 194400]));
    expect(v?.priceChange).toBeUndefined();
    expect(v?.currentAmount).toBe(194400);
    expect(v?.annualDrain).toBe(194400 * 12);
  });

  it('compares the last run with the last amount of the previous run, not its first amount', () => {
    // Runs: [100, 105, 110] then [111]. 111 vs 110 is under 5%, so no price change.
    const [v] = detectRecurring(series('CITY GYM', MONTHLY_6.slice(0, 4), [10000, 10500, 11000, 11100]));
    expect(v?.priceChange).toBeUndefined();
    expect(v?.currentAmount).toBe(11100);
  });

  it('exactly 5% is not a price change; just over 5% is', () => {
    const dates = MONTHLY_6.slice(0, 3);
    // Runs [10000, 10800] then [11340]: 11340 is exactly 5% above 10800.
    expect(detectRecurring(series('CITY GYM', dates, [10000, 10800, 11340]))[0]?.priceChange).toBeUndefined();
    expect(detectRecurring(series('CITY GYM', dates, [10000, 10800, 11341]))[0]?.priceChange).toEqual({
      from: 10800,
      to: 11341,
      direction: 'hike',
    });
  });

  it('within 10% of the run start (inclusive) stays in the run', () => {
    // 11000 is exactly 10% above 10000, so one run and no price change.
    const [v] = detectRecurring(series('CITY GYM', MONTHLY_6.slice(0, 3), [10000, 10000, 11000]));
    expect(v?.priceChange).toBeUndefined();
  });

  it('stable via the median rule with 3 runs: the last run is compared with the previous run', () => {
    // Runs: [100 x7], [200], [100, 100]. Not <= 2 runs, but 9 of 10 amounts are within 10% of the median.
    const dates = datesFromGaps('2025-01-05', [31, 28, 31, 30, 31, 30, 31, 31, 30]);
    const amounts = [10000, 10000, 10000, 10000, 10000, 10000, 10000, 20000, 10000, 10000];
    const [v] = detectRecurring(series('CITY GYM', dates, amounts));
    expect(v?.cadence).toBe('monthly');
    expect(v?.currentAmount).toBe(10000);
    expect(v?.priceChange).toEqual({ from: 20000, to: 10000, direction: 'drop' });
  });

  it('even-count median rounds half up (it decides stability here)', () => {
    // Order 110, 50, 99, 100 gives 3 runs, so only the median rule can make it stable.
    // Median of 99 and 100 rounds up to 100: 99, 100 and 110 are within 10% (3 of 4 = 75%).
    // Rounded down to 99, 110 would fall outside and only 2 of 4 would pass.
    const dates = MONTHLY_6.slice(0, 4);
    const [v] = detectRecurring(series('CITY GYM', dates, [110, 50, 99, 100]));
    expect(v?.cadence).toBe('monthly');
  });

  it('unstable amounts (electricity-style) are not detected', () => {
    const amounts = [146000, 97000, 105400, 135100, 107100, 171800];
    expect(detectRecurring(series('BESCOM ELECTRICITY', MONTHLY_6, amounts))).toEqual([]);
  });

  it('three distinct price levels with no majority are not detected', () => {
    expect(detectRecurring(series('FRIEND ARJUN', MONTHLY_6, [50000, 150000, 100000, 50000, 100000, 50000]))).toEqual([]);
  });
});

describe('same-day collapse', () => {
  const dates = ['2026-05-05', '2026-06-05', '2026-07-05'];

  it('two debits at one merchant on one day are one occurrence with the larger amount', () => {
    const txns = [...series('NETFLIX COM', dates, 64900), debit('2026-07-05', 'NETFLIX COM', 10000)];
    const [v] = detectRecurring(txns);
    expect(v?.occurrences).toBe(3);
    expect(v?.transactionDates).toEqual(dates);
    expect(v?.currentAmount).toBe(64900);
  });

  it('keeps the larger amount even when it comes second', () => {
    const txns = [debit('2026-07-05', 'NETFLIX COM', 10000), ...series('NETFLIX COM', dates, 64900)];
    expect(detectRecurring(txns)[0]?.currentAmount).toBe(64900);
    const bigger = [...series('NETFLIX COM', dates, 64900), debit('2026-07-05', 'NETFLIX COM', 70000)];
    expect(detectRecurring(bigger)[0]?.currentAmount).toBe(70000);
  });

  it('duplicates with the same amount count once', () => {
    const txns = [...series('NETFLIX COM', dates, 64900), ...series('NETFLIX COM', dates, 64900)];
    const [v] = detectRecurring(txns);
    expect(v?.occurrences).toBe(3);
    expect(v?.annualDrain).toBe(64900 * 12);
  });

  it('does not create a zero-day gap that breaks the cadence', () => {
    const doubled = dates.flatMap((date) => [debit(date, 'NETFLIX COM', 64900), debit(date, 'NETFLIX COM', 64900)]);
    expect(detectRecurring(doubled)[0]?.cadence).toBe('monthly');
  });

  it('collapses two separate one-off charges on one day into one, so it is still a one-off', () => {
    expect(detectRecurring([debit('2026-05-09', 'SWIGGY', 41200), debit('2026-05-09', 'SWIGGY', 38900)])).toEqual([]);
  });

  it('does not collapse different merchants on the same day', () => {
    const txns = [...series('NETFLIX COM', dates, 64900), ...series('SPOTIFY INDIA', dates, 11900)];
    expect(detectRecurring(txns).map((v) => v.key).sort()).toEqual(['NETFLIX', 'SPOTIFY']);
  });
});

describe('possibly cancelled: CANCELLED_AFTER_DAYS boundary', () => {
  const cases: Array<[string, string, number[], number]> = [
    ['weekly', 'FRESH MILK', [7, 7], 10],
    ['every28days', 'JIO PREPAID RECHARGE', [28, 28], 42],
    ['monthly', 'NETFLIX COM', [31, 30], 45],
    ['quarterly', 'CITY GYM', [91, 92], 136],
    ['yearly', 'BOOK CLUB', [365], 547],
  ];

  it.each(cases)('%s: not cancelled at the limit, cancelled one day after', (cadence, name, gaps, limit) => {
    const dates = datesFromGaps('2024-01-10', gaps);
    const last = dates[dates.length - 1] as string;
    const charges = series(name, dates, 10000);

    const atLimit = detectRecurring([...charges, credit(addDays(last, limit))]);
    expect(atLimit[0]?.cadence).toBe(cadence);
    expect(atLimit[0]?.possiblyCancelled).toBe(false);

    const afterLimit = detectRecurring([...charges, credit(addDays(last, limit + 1))]);
    expect(afterLimit[0]?.cadence).toBe(cadence);
    expect(afterLimit[0]?.possiblyCancelled).toBe(true);
  });

  it('uses the latest date of any transaction, credits included, as the reference date', () => {
    const charges = series('NETFLIX COM', ['2026-05-05', '2026-06-05', '2026-07-05'], 64900);
    expect(detectRecurring(charges)[0]?.possiblyCancelled).toBe(false);
    expect(detectRecurring([...charges, credit('2026-10-01')])[0]?.possiblyCancelled).toBe(true);
    expect(detectRecurring([...charges, debit('2026-10-01', 'SWIGGY', 500)])[0]?.possiblyCancelled).toBe(true);
  });

  it('still reports a possibly cancelled vampire with its full details', () => {
    const [v] = detectRecurring([...series('SONYLIV', ['2026-05-15', '2026-06-15', '2026-07-15'], 29900), credit('2026-10-29')]);
    expect(v).toMatchObject({ key: 'SONY LIV', possiblyCancelled: true, annualDrain: 29900 * 12 });
  });
});

describe('nextExpectedDate and month-end clamping', () => {
  const next = (name: string, dates: string[]): string | undefined => detectRecurring(series(name, dates, 10000))[0]?.nextExpectedDate;

  it('monthly: 31 Jan -> 28 Feb, and 29 Feb in a leap year', () => {
    expect(next('NETFLIX COM', ['2025-11-30', '2025-12-31', '2026-01-31'])).toBe('2026-02-28');
    expect(next('NETFLIX COM', ['2023-11-30', '2023-12-31', '2024-01-31'])).toBe('2024-02-29');
  });

  it('monthly: 31 Mar -> 30 Apr, and an ordinary day keeps its day-of-month', () => {
    expect(next('NETFLIX COM', ['2026-01-31', '2026-03-03', '2026-03-31'])).toBe('2026-04-30');
    expect(next('NETFLIX COM', ['2026-08-05', '2026-09-05', '2026-10-05'])).toBe('2026-11-05');
  });

  it('quarterly: 30 Nov + 3 months -> 28 Feb', () => {
    expect(next('CITY GYM', ['2026-05-31', '2026-08-30', '2026-11-30'])).toBe('2027-02-28');
  });

  it('yearly: 29 Feb + 1 year -> 28 Feb', () => {
    expect(next('BOOK CLUB', ['2023-03-01', '2024-02-29'])).toBe('2025-02-28');
  });

  it('weekly and every-28-days add days across month and year ends', () => {
    expect(next('FRESH MILK', ['2026-12-14', '2026-12-21', '2026-12-28'])).toBe('2027-01-04');
    expect(next('JIO PREPAID RECHARGE', ['2026-11-06', '2026-12-04', '2027-01-01'])).toBe('2027-01-29');
  });
});

describe('cadence selection', () => {
  const cadenceFor = (gaps: number[], name = 'CITY GYM'): string | undefined =>
    detectRecurring(series(name, datesFromGaps('2025-01-10', gaps), 10000))[0]?.cadence;

  it('every-28-days when at least 70% of gaps are exactly 28 and none exceeds 29', () => {
    expect(cadenceFor([28, 28, 28, 28, 28, 28])).toBe('every28days');
    expect(cadenceFor([28, 28, 28, 29])).toBe('every28days'); // 75% exactly 28, max 29
  });

  it('monthly when one gap exceeds 29, even with 75% exactly 28', () => {
    expect(cadenceFor([28, 28, 28, 30])).toBe('monthly');
  });

  it('monthly when both fit but fewer than 70% of gaps are exactly 28', () => {
    expect(cadenceFor([28, 29, 29])).toBe('monthly');
    expect(cadenceFor([29, 29, 29])).toBe('monthly');
  });

  it('every-28-days when only that window fits (27-day gaps)', () => {
    expect(cadenceFor([27, 27, 27])).toBe('every28days');
  });

  it('detects weekly, quarterly and yearly', () => {
    expect(cadenceFor([7, 6, 8, 7])).toBe('weekly');
    expect(cadenceFor([91, 90, 92])).toBe('quarterly');
    expect(cadenceFor([365])).toBe('yearly');
  });

  it.each([
    [5, undefined],
    [6, 'weekly'],
    [8, 'weekly'],
    [9, undefined],
    [26, undefined],
    [27, 'every28days'],
    [28, 'every28days'],
    [29, 'monthly'],
    [34, 'monthly'],
    [35, undefined],
    [84, undefined],
    [85, 'quarterly'],
    [95, 'quarterly'],
    [96, undefined],
    [349, undefined],
    [350, 'yearly'],
    [380, 'yearly'],
    [381, undefined],
  ])('window boundary: equal gaps of %i days -> %s', (gap, expected) => {
    expect(cadenceFor([gap, gap])).toBe(expected);
  });
});

describe('the 70% gap rule and minimum occurrences', () => {
  const detect = (gaps: number[]) => detectRecurring(series('CITY GYM', datesFromGaps('2025-01-10', gaps), 10000));

  it('3 of 4 gaps (75%) in the window is enough', () => {
    const [v] = detect([30, 31, 30, 60]);
    expect(v?.cadence).toBe('monthly');
    expect(v?.occurrences).toBe(5);
  });

  it('exactly 70% (7 of 10 gaps) is enough; 6 of 9 (67%) is not', () => {
    expect(detect([30, 31, 30, 31, 30, 31, 30, 60, 60, 60])[0]?.cadence).toBe('monthly');
    expect(detect([30, 31, 30, 31, 30, 31, 60, 60, 60])).toEqual([]);
  });

  it('2 of 3 gaps (67%) is not enough', () => {
    expect(detect([30, 31, 60])).toEqual([]);
  });

  it('with 2 gaps, both must fit', () => {
    expect(detect([30, 60])).toEqual([]);
    expect(detect([30, 31])[0]?.cadence).toBe('monthly');
  });

  it('needs 3 occurrences for non-yearly cadences', () => {
    expect(detect([30])).toEqual([]);
    expect(detect([7])).toEqual([]);
    expect(detect([91])).toEqual([]);
  });

  it('a single one-off debit is never a vampire', () => {
    expect(detectRecurring([debit('2026-05-05', 'NETFLIX COM', 64900)])).toEqual([]);
  });

  it('yearly needs 2 occurrences and its confidence is at most 0.6', () => {
    const [v] = detectRecurring(series('NETFLIX COM', ['2025-03-01', '2026-03-01'], 649000));
    expect(v?.cadence).toBe('yearly');
    expect(v?.confidence).toBeLessThanOrEqual(0.6);
    expect(v?.annualDrain).toBe(649000);
    expect(v?.nextExpectedDate).toBe('2027-03-01');
  });
});

describe('tiers, fields and confidence', () => {
  it('a known merchant is tier subscription with the canonical name and alias category', () => {
    const [v] = detectRecurring(series('NETFLIX COM', MONTHLY_6, 64900));
    expect(v).toMatchObject({ merchant: 'Netflix', key: 'NETFLIX', tier: 'subscription', category: 'ott-video' });
  });

  it('an unknown merchant is tier other, title-case display, category other', () => {
    const [v] = detectRecurring(series('LANDLORD RAMESH', MONTHLY_6, 1800000));
    expect(v).toMatchObject({ merchant: 'Landlord Ramesh', key: 'LANDLORD RAMESH', tier: 'other', category: 'other' });
  });

  it('fills every field', () => {
    const [v] = detectRecurring(series('NETFLIX COM', MONTHLY_6, 64900));
    expect(v).toEqual({
      merchant: 'Netflix',
      key: 'NETFLIX',
      category: 'ott-video',
      tier: 'subscription',
      cadence: 'monthly',
      currentAmount: 64900,
      occurrences: 6,
      lastChargeDate: '2026-10-13',
      nextExpectedDate: '2026-11-13',
      annualDrain: 64900 * 12,
      confidence: 1,
      possiblyCancelled: false,
      transactionDates: MONTHLY_6,
    });
  });

  it('computes confidence from regularity, amount share, count and tier', () => {
    // Spotify: regularity 1, 4 of 6 amounts within 10% of the median 119, 6 occurrences, known.
    const [spotify] = detectRecurring(series('SPOTIFY INDIA', MONTHLY_6, [11900, 11900, 11900, 11900, 13900, 13900]));
    expect(spotify?.confidence).toBeCloseTo(0.4 + 0.3 * (4 / 6) + 0.2 + 0.1, 10);
    // Unknown merchant, 3 occurrences, perfect regularity and amounts.
    const [gym] = detectRecurring(series('CITY GYM', MONTHLY_6.slice(0, 3), 10000));
    expect(gym?.confidence).toBeCloseTo(0.4 + 0.3 + 0.2 * 0.5, 10);
  });
});

describe('input handling and ordering', () => {
  it('returns [] for no transactions or only credits', () => {
    expect(detectRecurring([])).toEqual([]);
    expect(detectRecurring(['2026-05-01', '2026-06-01', '2026-07-01'].map((d) => credit(d)))).toEqual([]);
  });

  it('ignores credits even when they recur at the same merchant', () => {
    const credits = MONTHLY_6.map((date) => ({ ...debit(date, 'NETFLIX COM', 64900), direction: 'credit' as const }));
    expect(detectRecurring(credits)).toEqual([]);
  });

  it('does not group debits whose narration leaves no merchant key', () => {
    const txns = MONTHLY_6.map((date, i) => ({ date, narration: String(4_100_000_000 + i), amount: 50000, direction: 'debit' as const }));
    expect(detectRecurring(txns)).toEqual([]);
  });

  it('groups the same merchant across different reference numbers and narration styles', () => {
    const txns: Transaction[] = [
      { date: '2026-05-05', narration: 'NACH-NETFLIX COM-5942859575', amount: 64900, direction: 'debit' },
      { date: '2026-06-05', narration: 'TO TRANSFER-UPI/DR/412301047290/NETFLIX/YESB/netflix@ybl/UPI MANDATE', amount: 64900, direction: 'debit' },
      { date: '2026-07-05', narration: 'netflix.com 3852512026', amount: 64900, direction: 'debit' },
    ];
    expect(detectRecurring(txns)).toHaveLength(1);
  });

  it('sorts by annual drain, highest first, then merchant name', () => {
    const txns = [
      ...series('YOUTUBE PREMIUM', MONTHLY_6, 12900),
      ...series('NETFLIX COM', MONTHLY_6, 64900),
      ...series('CORNER STORE', MONTHLY_6, 12900),
      ...series('BOOK CLUB', MONTHLY_6, 12900),
    ];
    expect(detectRecurring(txns).map((v) => v.merchant)).toEqual(['Netflix', 'Book Club', 'Corner Store', 'YouTube Premium']);
  });

  it('sorts weekly vs monthly by annual drain, not by amount', () => {
    const weekly = series('FRESH MILK', datesFromGaps('2026-09-01', [7, 7, 7, 7, 7, 7, 7]), 21000); // 21000 x 52
    const monthly = series('NETFLIX COM', ['2026-08-20', '2026-09-20', '2026-10-20'], 64900); // 64900 x 12
    expect(detectRecurring([...monthly, ...weekly]).map((v) => v.key)).toEqual(['FRESH MILK', 'NETFLIX']);
  });
});
