import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../src/core/detectRecurring';
import { parseStatement } from '../src/core/parseStatement';
import { DUPLICATE_CATEGORIES, flagDuplicates, isEligible, totals, type Decisions } from '../src/core/savings';
import type { Vampire } from '../src/core/types';

/** A vampire with sensible defaults; only the fields savings.ts reads matter here. */
function vampire(key: string, annualDrain: number, overrides: Partial<Vampire> = {}): Vampire {
  return {
    merchant: key,
    key,
    category: 'other',
    tier: 'subscription',
    cadence: 'monthly',
    currentAmount: Math.round(annualDrain / 12),
    occurrences: 6,
    lastChargeDate: '2026-10-05',
    nextExpectedDate: '2026-11-05',
    annualDrain,
    confidence: 1,
    possiblyCancelled: false,
    transactionDates: [],
    ...overrides,
  };
}

const NONE = new Set<string>();

describe('isEligible', () => {
  it('a Subscription that is not possibly cancelled is always eligible', () => {
    expect(isEligible(vampire('NETFLIX', 778800), NONE)).toBe(true);
  });

  it('an Other recurring payment is eligible only after "Count it"', () => {
    const rent = vampire('LANDLORD RAMESH', 21600000, { tier: 'other' });
    expect(isEligible(rent, NONE)).toBe(false);
    expect(isEligible(rent, new Set(['LANDLORD RAMESH']))).toBe(true);
  });

  it('a possibly cancelled vampire is never eligible, counted or not', () => {
    expect(isEligible(vampire('SONY LIV', 358800, { possiblyCancelled: true }), NONE)).toBe(false);
    const milk = vampire('FRESH MILK', 1092000, { tier: 'other', possiblyCancelled: true });
    expect(isEligible(milk, new Set(['FRESH MILK']))).toBe(false);
  });

  it('counting a Subscription key changes nothing', () => {
    expect(isEligible(vampire('NETFLIX', 778800), new Set(['NETFLIX']))).toBe(true);
  });
});

describe('totals: decisions', () => {
  const list = [vampire('A', 120000), vampire('B', 240000), vampire('C', 360000), vampire('D', 480000)];

  it('with no decisions, everything eligible is drain and to review', () => {
    expect(totals(list, {}, NONE)).toEqual({ monthlyDrain: 100000, yearlyDrain: 1200000, savedPerYear: 0, toReview: 4 });
  });

  it('undecided and kept are drain; staked is savings; dismissed is neither', () => {
    const decisions: Decisions = { A: 'undecided', B: 'keep', C: 'stake', D: 'dismiss' };
    expect(totals(list, decisions, NONE)).toEqual({
      yearlyDrain: 120000 + 240000,
      monthlyDrain: 30000,
      savedPerYear: 360000,
      toReview: 1,
    });
  });

  it('keep stays in the drain but leaves the to-review count (Req 6.2)', () => {
    const before = totals(list, {}, NONE);
    const after = totals(list, { B: 'keep' }, NONE);
    expect(after.yearlyDrain).toBe(before.yearlyDrain);
    expect(after.toReview).toBe(before.toReview - 1);
    expect(after.savedPerYear).toBe(0);
  });

  it('stake moves the drain to "Saved per year" (Req 6.1)', () => {
    const after = totals(list, { C: 'stake' }, NONE);
    expect(after.yearlyDrain).toBe(1200000 - 360000);
    expect(after.savedPerYear).toBe(360000);
    expect(after.toReview).toBe(3);
  });

  it('dismiss leaves the drain, the savings and the to-review count (Req 6.3)', () => {
    const after = totals(list, { D: 'dismiss' }, NONE);
    expect(after).toEqual({ yearlyDrain: 720000, monthlyDrain: 60000, savedPerYear: 0, toReview: 3 });
  });

  it('a missing decision is undecided; decisions for unknown keys are ignored', () => {
    expect(totals(list, { ZZZ: 'stake', A: undefined }, NONE)).toEqual(totals(list, {}, NONE));
  });

  it('undoing a decision (back to undecided) restores the original totals', () => {
    const original = totals(list, {}, NONE);
    expect(totals(list, { A: 'undecided', B: 'undecided', C: 'undecided', D: 'undecided' }, NONE)).toEqual(original);
  });
});

describe('totals: eligibility', () => {
  const sub = vampire('NETFLIX', 778800);
  const rent = vampire('LANDLORD RAMESH', 21600000, { tier: 'other' });
  const lapsed = vampire('SONY LIV', 358800, { possiblyCancelled: true });

  it('an uncounted Other recurring payment is excluded from every total, whatever its decision', () => {
    for (const decision of ['undecided', 'keep', 'stake', 'dismiss'] as const) {
      expect(totals([sub, rent], { 'LANDLORD RAMESH': decision }, NONE)).toEqual(totals([sub], {}, NONE));
    }
  });

  it('"Count it" adds an Other recurring payment to the drain and the to-review count; undo removes it', () => {
    const counted = new Set(['LANDLORD RAMESH']);
    expect(totals([sub, rent], {}, counted)).toEqual({
      yearlyDrain: 778800 + 21600000,
      monthlyDrain: Math.floor((778800 + 21600000 + 6) / 12),
      savedPerYear: 0,
      toReview: 2,
    });
    expect(totals([sub, rent], {}, NONE)).toEqual(totals([sub], {}, NONE));
  });

  it('a counted Other recurring payment can be staked', () => {
    expect(totals([sub, rent], { 'LANDLORD RAMESH': 'stake' }, new Set(['LANDLORD RAMESH'])).savedPerYear).toBe(21600000);
  });

  it('a possibly cancelled vampire is excluded from drain, savings and to review, whatever its decision (Req 4.10)', () => {
    for (const decision of ['undecided', 'keep', 'stake', 'dismiss'] as const) {
      expect(totals([sub, lapsed], { 'SONY LIV': decision }, new Set(['SONY LIV']))).toEqual(totals([sub], {}, NONE));
    }
  });

  it('counted keys that are not in the list are ignored', () => {
    expect(totals([sub], {}, new Set(['NOBODY']))).toEqual(totals([sub], {}, NONE));
  });

  it('returns zeros for no vampires', () => {
    expect(totals([], {}, NONE)).toEqual({ monthlyDrain: 0, yearlyDrain: 0, savedPerYear: 0, toReview: 0 });
  });
});

describe('totals: monthlyDrain rounds yearlyDrain / 12 half up', () => {
  it.each([
    [0, 0],
    [12, 1],
    [100, 8], // 8.33
    [101, 8], // 8.42
    [102, 9], // 8.5 rounds up
    [103, 9], // 8.58
    [778800, 64900], // exact
    [5425100, 452092], // 452091.67
  ])('yearly %i -> monthly %i', (yearly, monthly) => {
    expect(totals([vampire('A', yearly)], {}, NONE).monthlyDrain).toBe(monthly);
  });
});

describe('flagDuplicates', () => {
  const spotify = vampire('SPOTIFY', 166800, { category: 'music' });
  const youtube = vampire('YOUTUBE PREMIUM', 154800, { category: 'music' });
  const netflix = vampire('NETFLIX', 778800, { category: 'ott-video' });
  const prime = vampire('AMAZON PRIME', 179900, { category: 'ott-video' });
  const googleOne = vampire('GOOGLE ONE', 156000, { category: 'cloud' });
  const icloud = vampire('APPLE ICLOUD', 90000, { category: 'cloud' });

  it('flags a category with two or more vampires', () => {
    expect(flagDuplicates([spotify, youtube, netflix, googleOne], {}, NONE)).toEqual(['music']);
  });

  it('reports every duplicated category, in music, ott-video, cloud order', () => {
    expect(flagDuplicates([icloud, prime, googleOne, youtube, netflix, spotify], {}, NONE)).toEqual(DUPLICATE_CATEGORIES);
    expect(DUPLICATE_CATEGORIES).toEqual(['music', 'ott-video', 'cloud']);
  });

  it('does not flag a single vampire in a category', () => {
    expect(flagDuplicates([spotify, netflix, googleOne], {}, NONE)).toEqual([]);
  });

  it('only checks music, ott-video and cloud', () => {
    const jio = vampire('JIO', 388700, { category: 'telecom' });
    const airtel = vampire('AIRTEL', 718800, { category: 'telecom' });
    const gym = vampire('CULT.FIT', 1440000, { category: 'fitness' });
    const gym2 = vampire('OTHER GYM', 600000, { category: 'fitness' });
    expect(flagDuplicates([jio, airtel, gym, gym2], {}, NONE)).toEqual([]);
  });

  it('staked vampires still count toward duplicates', () => {
    expect(flagDuplicates([spotify, youtube], { SPOTIFY: 'stake' }, NONE)).toEqual(['music']);
    expect(flagDuplicates([spotify, youtube], { SPOTIFY: 'stake', 'YOUTUBE PREMIUM': 'keep' }, NONE)).toEqual(['music']);
  });

  it('dismissed vampires do not count', () => {
    expect(flagDuplicates([spotify, youtube], { 'YOUTUBE PREMIUM': 'dismiss' }, NONE)).toEqual([]);
  });

  it('possibly cancelled vampires do not count', () => {
    expect(flagDuplicates([spotify, { ...youtube, possiblyCancelled: true }], {}, NONE)).toEqual([]);
  });

  it('an Other recurring payment counts only once counted', () => {
    const otherMusic = vampire('MUSIC SCHOOL', 600000, { category: 'music', tier: 'other' });
    expect(flagDuplicates([spotify, otherMusic], {}, NONE)).toEqual([]);
    expect(flagDuplicates([spotify, otherMusic], {}, new Set(['MUSIC SCHOOL']))).toEqual(['music']);
  });

  it('returns [] for no vampires', () => {
    expect(flagDuplicates([], {}, NONE)).toEqual([]);
  });
});

describe('inputs are not modified', () => {
  it('totals and flagDuplicates leave vampires, decisions and counted unchanged', () => {
    const list = [vampire('SPOTIFY', 166800, { category: 'music' }), vampire('YOUTUBE PREMIUM', 154800, { category: 'music' })];
    const decisions: Decisions = { SPOTIFY: 'stake' };
    const counted = new Set(['X']);
    const snapshot = JSON.stringify([list, decisions, [...counted]]);
    totals(list, decisions, counted);
    flagDuplicates(list, decisions, counted);
    expect(JSON.stringify([list, decisions, [...counted]])).toBe(snapshot);
  });
});

describe('sample statement', () => {
  const vampires = detectRecurring(
    parseStatement(readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8')).transactions,
  );
  // Netflix 778800 + Spotify 166800 + Google One 156000 + Cult.fit 1440000 + ChatGPT 2340000
  // + YouTube Premium 154800 + Jio 388700 (299 x 13).
  const SUBSCRIPTIONS_YEARLY = 5425100;

  it('starts with the seven Subscriptions in the Blood Meter and rent left out', () => {
    expect(totals(vampires, {}, NONE)).toEqual({
      yearlyDrain: SUBSCRIPTIONS_YEARLY,
      monthlyDrain: 452092,
      savedPerYear: 0,
      toReview: 7,
    });
  });

  it('"Count it" on rent adds ₹2,16,000 a year and one more to review', () => {
    const t = totals(vampires, {}, new Set(['LANDLORD RAMESH']));
    expect(t.yearlyDrain).toBe(SUBSCRIPTIONS_YEARLY + 21600000);
    expect(t.toReview).toBe(8);
  });

  it('staking Netflix saves ₹7,788 a year', () => {
    const t = totals(vampires, { NETFLIX: 'stake' }, NONE);
    expect(t.savedPerYear).toBe(778800);
    expect(t.yearlyDrain).toBe(SUBSCRIPTIONS_YEARLY - 778800);
    expect(t.toReview).toBe(6);
  });

  it('flags Spotify and YouTube Premium (music) as possible duplicates, and nothing else', () => {
    expect(flagDuplicates(vampires, {}, NONE)).toEqual(['music']);
    expect(flagDuplicates(vampires, { 'YOUTUBE PREMIUM': 'dismiss' }, NONE)).toEqual([]);
  });
});
