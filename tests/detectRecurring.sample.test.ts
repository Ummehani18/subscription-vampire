import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../src/core/detectRecurring';
import { parseStatement } from '../src/core/parseStatement';
import type { Vampire } from '../src/core/types';

const load = (relative: string) => parseStatement(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const byKey = (vampires: Vampire[], key: string): Vampire | undefined => vampires.find((v) => v.key === key);

describe('Task 5.4: data/sample-statement.csv matches data/README.md', () => {
  const parsed = load('../data/sample-statement.csv');
  const vampires = detectRecurring(parsed.transactions);
  const subscriptions = vampires.filter((v) => v.tier === 'subscription');
  const other = vampires.filter((v) => v.tier === 'other');

  it('parses the sample without mapping or skipped rows', () => {
    expect(parsed.needsMapping).toBe(false);
    expect(parsed.skippedRows).toBe(0);
  });

  it('finds exactly seven Subscriptions', () => {
    expect(subscriptions.map((v) => v.merchant).sort()).toEqual(
      ['ChatGPT', 'Cult.fit', 'Google One', 'Jio', 'Netflix', 'Spotify', 'YouTube Premium'].sort(),
    );
  });

  // Rows of the "Expected Subscriptions, tier 1" table.
  it.each([
    ['NETFLIX', 'monthly', 64900, 6],
    ['SPOTIFY', 'monthly', 13900, 6],
    ['GOOGLE ONE', 'monthly', 13000, 6],
    ['CULT.FIT', 'monthly', 120000, 6],
    ['CHATGPT', 'monthly', 195000, 6],
    ['YOUTUBE PREMIUM', 'monthly', 12900, 6],
    ['JIO', 'every28days', 29900, 7],
  ] as const)('%s: cadence %s, current amount %i paise, %i charges', (key, cadence, currentAmount, occurrences) => {
    const v = byKey(subscriptions, key);
    expect(v).toBeDefined();
    expect(v).toMatchObject({ cadence, currentAmount, occurrences, annualDrain: currentAmount * (cadence === 'monthly' ? 12 : 13) });
  });

  it('Spotify: price hike ₹119 -> ₹139 in September, annual drain ₹1,668', () => {
    const spotify = byKey(vampires, 'SPOTIFY');
    expect(spotify?.priceChange).toEqual({ from: 11900, to: 13900, direction: 'hike' });
    expect(spotify?.annualDrain).toBe(166800);
    expect(spotify?.transactionDates[4]).toBe('2026-09-13');
  });

  it('only Spotify has a price change', () => {
    expect(vampires.filter((v) => v.priceChange).map((v) => v.key)).toEqual(['SPOTIFY']);
  });

  it('YouTube Premium and Spotify share the music category', () => {
    expect(byKey(vampires, 'YOUTUBE PREMIUM')?.category).toBe('music');
    expect(byKey(vampires, 'SPOTIFY')?.category).toBe('music');
  });

  it('Jio: every 28 days, all 6 gaps exactly 28 days', () => {
    const jio = byKey(vampires, 'JIO');
    expect(jio?.cadence).toBe('every28days');
    expect(jio?.transactionDates).toEqual([
      '2026-05-02', '2026-05-30', '2026-06-27', '2026-07-25', '2026-08-22', '2026-09-19', '2026-10-17',
    ]);
    expect(jio?.nextExpectedDate).toBe('2026-11-14');
  });

  it('rent is the only Other recurring payment: Landlord Ramesh, monthly, ₹18,000, 6 charges on the 3rd', () => {
    expect(other).toHaveLength(1);
    expect(other[0]).toMatchObject({
      merchant: 'Landlord Ramesh',
      tier: 'other',
      cadence: 'monthly',
      currentAmount: 1800000,
      occurrences: 6,
    });
    expect(other[0]?.transactionDates.every((d) => d.endsWith('-03'))).toBe(true);
  });

  it('nothing is possibly cancelled (reference date 26 Oct 2026)', () => {
    const latest = parsed.transactions.reduce((max, t) => (t.date > max ? t.date : max), '');
    expect(latest).toBe('2026-10-26');
    expect(vampires.filter((v) => v.possiblyCancelled)).toEqual([]);
  });

  it('finds nothing else: exactly 8 vampires', () => {
    expect(vampires).toHaveLength(8);
  });

  it('does not detect anything from the "Must NOT be detected" list', () => {
    const keys = new Set(vampires.map((v) => v.key));
    for (const key of [
      'ACME TECH', // salary (credit)
      'BESCOM ELECTRICITY',
      'SWIGGY',
      'ZOMATO',
      'AMAZON PAY',
      'BLINKIT',
      'BIGBASKET',
      'DECATHLON',
      'UBER INDIA',
      'IRCTC',
      'PHARMEASY',
      'FRIEND ARJUN',
    ]) {
      expect(keys.has(key)).toBe(false);
    }
  });

  it('is sorted by annual drain, highest first', () => {
    expect(vampires.map((v) => v.key)).toEqual([
      'LANDLORD RAMESH', 'CHATGPT', 'CULT.FIT', 'NETFLIX', 'JIO', 'SPOTIFY', 'GOOGLE ONE', 'YOUTUBE PREMIUM',
    ]);
  });

  it('confidences are within 0-1', () => {
    for (const v of vampires) {
      expect(v.confidence).toBeGreaterThanOrEqual(0);
      expect(v.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('Task 3.2 fixtures: the patterns they were built with are detected', () => {
  it('SBI-style: Netflix, Google One, JioHotstar (price drop), Airtel, and rent as Other recurring', () => {
    const vampires = detectRecurring(load('./fixtures/sbi-style.csv').transactions);
    expect(vampires.map((v) => `${v.key}:${v.tier}:${v.cadence}`).sort()).toEqual([
      'AIRTEL:subscription:monthly',
      'GOOGLE ONE:subscription:monthly',
      'JIOHOTSTAR:subscription:monthly',
      'LANDLORD SURESH:other:monthly',
      'NETFLIX:subscription:monthly',
    ]);
    expect(byKey(vampires, 'JIOHOTSTAR')?.priceChange).toEqual({ from: 29900, to: 14900, direction: 'drop' });
    expect(vampires.some((v) => v.possiblyCancelled)).toBe(false);
  });

  it('ICICI-style: Spotify hike, Jio every 28 days, Sony LIV and the weekly milk possibly cancelled', () => {
    const vampires = detectRecurring(load('./fixtures/icici-style.csv').transactions);
    expect(vampires.map((v) => `${v.key}:${v.tier}:${v.cadence}:${v.possiblyCancelled}`).sort()).toEqual([
      'CHATGPT:subscription:monthly:false',
      'FRESH MILK:other:weekly:true',
      'HOUSE RENT:other:monthly:false',
      'JIO:subscription:every28days:false',
      'SONY LIV:subscription:monthly:true',
      'SPOTIFY:subscription:monthly:false',
      'YOUTUBE PREMIUM:subscription:monthly:false',
    ]);
    expect(byKey(vampires, 'SPOTIFY')?.priceChange?.direction).toBe('hike');
    // ChatGPT's small exchange-rate variation stays one run: no price change, latest amount used.
    expect(byKey(vampires, 'CHATGPT')).toMatchObject({ currentAmount: 194400, annualDrain: 194400 * 12 });
    expect(byKey(vampires, 'CHATGPT')?.priceChange).toBeUndefined();
  });
});
