import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../src/core/detectRecurring';
import { parseStatement } from '../src/core/parseStatement';
import { totals, type Decisions } from '../src/core/savings';
import type { Decision, Vampire } from '../src/core/types';

const DECISIONS: readonly Decision[] = ['undecided', 'keep', 'stake', 'dismiss'];

/**
 * The P11 right-hand side, written from the spec rather than from savings.ts:
 * eligible = not possibly cancelled AND (Subscription OR counted); a missing
 * decision means undecided; dismissed vampires are left out.
 */
function eligibleNonDismissedSum(vampires: readonly Vampire[], decisions: Decisions, counted: ReadonlySet<string>): number {
  return vampires
    .filter((v) => !v.possiblyCancelled)
    .filter((v) => v.tier === 'subscription' || counted.has(v.key))
    .filter((v) => (decisions[v.key] ?? 'undecided') !== 'dismiss')
    .reduce((sum, v) => sum + v.annualDrain, 0);
}

/** A vampire with every field savings.ts could read varied. Keys come from the caller so they are unique. */
const vampireFor = (key: string): fc.Arbitrary<Vampire> =>
  fc
    .record({
      tier: fc.constantFrom<Vampire['tier']>('subscription', 'other'),
      category: fc.constantFrom('music', 'ott-video', 'cloud', 'fitness', 'telecom', 'other'),
      cadence: fc.constantFrom<Vampire['cadence']>('weekly', 'every28days', 'monthly', 'quarterly', 'yearly'),
      annualDrain: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 1_000_000_000 })),
      possiblyCancelled: fc.boolean(),
    })
    .map((r) => ({
      merchant: key,
      key,
      category: r.category,
      tier: r.tier,
      cadence: r.cadence,
      currentAmount: r.annualDrain,
      occurrences: 3,
      lastChargeDate: '2026-10-05',
      nextExpectedDate: '2026-11-05',
      annualDrain: r.annualDrain,
      confidence: 1,
      possiblyCancelled: r.possiblyCancelled,
      transactionDates: [],
    }));

const vampireList: fc.Arbitrary<Vampire[]> = fc
  .integer({ min: 0, max: 25 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => vampireFor(`MERCHANT ${i}`))));

/**
 * Any decision assignment: per key a decision or no entry at all, plus entries
 * for keys that are not in the list. Any counted set: any subset of the keys,
 * plus keys that are not in the list.
 */
function assignmentFor(vampires: readonly Vampire[]): fc.Arbitrary<[Decisions, Set<string>]> {
  const keys = vampires.map((v) => v.key);
  const perKey = fc.tuple(...keys.map(() => fc.option(fc.constantFrom(...DECISIONS), { nil: undefined })));
  const strayDecisions = fc.dictionary(fc.constantFrom('STRAY A', 'STRAY B', 'STRAY C'), fc.constantFrom(...DECISIONS));
  const counted = fc.tuple(fc.subarray(keys), fc.subarray(['STRAY A', 'STRAY D']));
  return fc.tuple(perKey, strayDecisions, counted).map(([chosen, stray, [countedKeys, strayCounted]]) => {
    const decisions: Record<string, Decision> = { ...stray };
    keys.forEach((key, i) => {
      const decision = chosen[i];
      if (decision !== undefined) decisions[key] = decision;
    });
    return [decisions, new Set([...countedKeys, ...strayCounted])];
  });
}

const load = (relative: string): Vampire[] =>
  detectRecurring(parseStatement(readFileSync(new URL(relative, import.meta.url), 'utf8')).transactions);

describe('P11: totals splits the eligible, non-dismissed drain between savings and drain', () => {
  it('savedPerYear + yearlyDrain == sum of annualDrain over eligible, non-dismissed vampires, for any decisions and counted set', () => {
    let nonTrivial = 0;
    let withStake = 0;
    const runs = 3000;
    fc.assert(
      fc.property(
        vampireList.chain((vampires) => fc.tuple(fc.constant(vampires), assignmentFor(vampires))),
        ([vampires, [decisions, counted]]) => {
          const { savedPerYear, yearlyDrain } = totals(vampires, decisions, counted);
          const expected = eligibleNonDismissedSum(vampires, decisions, counted);
          if (expected > 0) nonTrivial += 1;
          if (savedPerYear > 0 && yearlyDrain > 0) withStake += 1;
          expect(savedPerYear + yearlyDrain).toBe(expected);
        },
      ),
      { numRuns: runs },
    );
    // The generator must regularly produce non-zero totals split between both sides.
    expect(nonTrivial).toBeGreaterThan(runs * 0.5);
    expect(withStake).toBeGreaterThan(runs * 0.2);
  });

  it.each([
    ['data/sample-statement.csv', '../data/sample-statement.csv'],
    ['tests/fixtures/sbi-style.csv', './fixtures/sbi-style.csv'],
    ['tests/fixtures/icici-style.csv', './fixtures/icici-style.csv'],
  ])('holds for the vampires detected in %s, for any decisions and counted set', (_name, path) => {
    const vampires = load(path);
    expect(vampires.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(assignmentFor(vampires), ([decisions, counted]) => {
        const { savedPerYear, yearlyDrain } = totals(vampires, decisions, counted);
        expect(savedPerYear + yearlyDrain).toBe(eligibleNonDismissedSum(vampires, decisions, counted));
      }),
      { numRuns: 1000 },
    );
  });
});
