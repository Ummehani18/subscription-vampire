import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  Cadence,
  Decision,
  ParseResult,
  Paise,
  PriceChange,
  Tier,
  Transaction,
  Vampire,
} from '../src/core/types';

// These checks are enforced by `tsc --noEmit` (part of `npm run build`).
describe('core types', () => {
  it('Vampire carries currentAmount and no typicalAmount', () => {
    expectTypeOf<Vampire['currentAmount']>().toEqualTypeOf<Paise>();
    expectTypeOf<Vampire>().not.toHaveProperty('typicalAmount');
  });

  it('Vampire has tier, possiblyCancelled and an optional priceChange', () => {
    expectTypeOf<Vampire['tier']>().toEqualTypeOf<Tier>();
    expectTypeOf<Vampire['possiblyCancelled']>().toEqualTypeOf<boolean>();
    expectTypeOf<Vampire['priceChange']>().toEqualTypeOf<PriceChange | undefined>();
  });

  it('PriceChange direction is hike or drop', () => {
    expectTypeOf<PriceChange['direction']>().toEqualTypeOf<'hike' | 'drop'>();
  });

  it('Decision includes dismiss', () => {
    expectTypeOf<Decision>().toEqualTypeOf<'undecided' | 'keep' | 'stake' | 'dismiss'>();
  });

  it('Cadence lists the five cadences', () => {
    expectTypeOf<Cadence>().toEqualTypeOf<
      'weekly' | 'every28days' | 'monthly' | 'quarterly' | 'yearly'
    >();
  });

  it('Transaction direction is debit or credit', () => {
    expectTypeOf<Transaction['direction']>().toEqualTypeOf<'debit' | 'credit'>();
  });

  it('ParseResult has optional mapper fields', () => {
    expectTypeOf<ParseResult['headers']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<ParseResult['rawRows']>().toEqualTypeOf<string[][] | undefined>();
  });

  it('a well-formed Vampire literal type-checks', () => {
    const v: Vampire = {
      merchant: 'Spotify',
      key: 'SPOTIFY',
      category: 'music',
      tier: 'subscription',
      cadence: 'monthly',
      currentAmount: 13900,
      occurrences: 6,
      lastChargeDate: '2026-10-13',
      nextExpectedDate: '2026-11-13',
      annualDrain: 13900 * 12,
      confidence: 0.9,
      possiblyCancelled: false,
      priceChange: { from: 11900, to: 13900, direction: 'hike' },
      transactionDates: ['2026-10-13'],
    };
    expect(v.annualDrain).toBe(v.currentAmount * 12);
  });
});
