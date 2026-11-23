import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStatement } from '../../src/core/parseStatement';
import { totals } from '../../src/core/savings';
import { appReducer, initialState, type AppAction, type AppState } from '../../src/ui/appState';

const SAMPLE = readFileSync(new URL('../../data/sample-statement.csv', import.meta.url), 'utf8');
const RENT = 'LANDLORD RAMESH';
const SUBSCRIPTIONS_YEARLY = 5425100;

const dashboard = (): AppState => appReducer(initialState, { type: 'statementParsed', result: parseStatement(SAMPLE) });
const run = (state: AppState, ...actions: AppAction[]): AppState => actions.reduce(appReducer, state);
const sums = (s: AppState) => totals(s.vampires, s.decisions, s.counted);

describe('decide: Stake / Keep / Dismiss (Req 6.1-6.3)', () => {
  it('Stake moves a vampire from the drain to "Saved per year"', () => {
    const s = run(dashboard(), { type: 'decide', key: 'NETFLIX', decision: 'stake' });
    expect(s.decisions).toEqual({ NETFLIX: 'stake' });
    expect(sums(s)).toEqual({
      yearlyDrain: SUBSCRIPTIONS_YEARLY - 778800,
      monthlyDrain: Math.floor((SUBSCRIPTIONS_YEARLY - 778800 + 6) / 12),
      savedPerYear: 778800,
      toReview: 6,
    });
  });

  it('Keep stays in the drain and leaves the to-review count', () => {
    const s = run(dashboard(), { type: 'decide', key: 'NETFLIX', decision: 'keep' });
    expect(sums(s)).toMatchObject({ yearlyDrain: SUBSCRIPTIONS_YEARLY, savedPerYear: 0, toReview: 6 });
  });

  it('Dismiss leaves the drain, the savings and the to-review count', () => {
    const s = run(dashboard(), { type: 'decide', key: 'NETFLIX', decision: 'dismiss' });
    expect(sums(s)).toMatchObject({ yearlyDrain: SUBSCRIPTIONS_YEARLY - 778800, savedPerYear: 0, toReview: 6 });
  });

  it('a later decision replaces the earlier one', () => {
    const s = run(
      dashboard(),
      { type: 'decide', key: 'NETFLIX', decision: 'keep' },
      { type: 'decide', key: 'NETFLIX', decision: 'stake' },
    );
    expect(s.decisions).toEqual({ NETFLIX: 'stake' });
  });

  it('an uncounted Other recurring payment cannot be kept or staked, only dismissed (Req 5.6)', () => {
    const start = dashboard();
    expect(run(start, { type: 'decide', key: RENT, decision: 'keep' })).toBe(start);
    expect(run(start, { type: 'decide', key: RENT, decision: 'stake' })).toBe(start);
    expect(run(start, { type: 'decide', key: RENT, decision: 'dismiss' }).decisions).toEqual({ [RENT]: 'dismiss' });
  });

  it('ignores unknown keys', () => {
    const start = dashboard();
    expect(run(start, { type: 'decide', key: 'NOBODY', decision: 'stake' })).toBe(start);
    expect(run(start, { type: 'count', key: 'NOBODY' })).toBe(start);
    expect(run(start, { type: 'undo', key: 'NOBODY' })).toBe(start);
  });

  it('ignores card actions outside the dashboard', () => {
    expect(run(initialState, { type: 'decide', key: 'NETFLIX', decision: 'stake' })).toBe(initialState);
  });
});

describe('Count it (Req 5.6)', () => {
  it('rent is out of the Blood Meter until "Count it"', () => {
    const start = dashboard();
    expect(sums(start)).toMatchObject({ yearlyDrain: SUBSCRIPTIONS_YEARLY, toReview: 7 });
    const s = run(start, { type: 'count', key: RENT });
    expect([...s.counted]).toEqual([RENT]);
    expect(sums(s)).toMatchObject({ yearlyDrain: SUBSCRIPTIONS_YEARLY + 21600000, toReview: 8 });
  });

  it('a counted Other recurring payment can then be kept or staked', () => {
    const s = run(dashboard(), { type: 'count', key: RENT }, { type: 'decide', key: RENT, decision: 'stake' });
    expect(sums(s).savedPerYear).toBe(21600000);
  });

  it('"Count it" does nothing for a Subscription or an already counted payment', () => {
    const start = dashboard();
    expect(run(start, { type: 'count', key: 'NETFLIX' })).toBe(start);
    const counted = run(start, { type: 'count', key: RENT });
    expect(run(counted, { type: 'count', key: RENT })).toBe(counted);
  });
});

describe('Undo (Req 6.4)', () => {
  it('undoes a decision back to undecided and restores the totals', () => {
    const start = dashboard();
    for (const decision of ['keep', 'stake', 'dismiss'] as const) {
      const s = run(start, { type: 'decide', key: 'NETFLIX', decision }, { type: 'undo', key: 'NETFLIX' });
      expect(s.decisions).toEqual({});
      expect(sums(s)).toEqual(sums(start));
    }
  });

  it('undoes "Count it": rent leaves the Blood Meter again', () => {
    const s = run(dashboard(), { type: 'count', key: RENT }, { type: 'undo', key: RENT });
    expect([...s.counted]).toEqual([]);
    expect(sums(s)).toEqual(sums(dashboard()));
  });

  it('steps back one change at a time: the decision first, then "Count it"', () => {
    const staked = run(dashboard(), { type: 'count', key: RENT }, { type: 'decide', key: RENT, decision: 'stake' });
    const once = run(staked, { type: 'undo', key: RENT });
    expect(once.decisions).toEqual({});
    expect(once.counted.has(RENT)).toBe(true);
    const twice = run(once, { type: 'undo', key: RENT });
    expect(twice.counted.has(RENT)).toBe(false);
  });

  it('undoes a dismissal of an uncounted payment without counting it', () => {
    const s = run(dashboard(), { type: 'decide', key: RENT, decision: 'dismiss' }, { type: 'undo', key: RENT });
    expect(s.decisions).toEqual({});
    expect(s.counted.has(RENT)).toBe(false);
  });

  it('does nothing when there is nothing to undo', () => {
    const start = dashboard();
    expect(run(start, { type: 'undo', key: 'NETFLIX' })).toBe(start);
    expect(run(start, { type: 'undo', key: RENT })).toBe(start);
  });

  it('leaves other cards alone', () => {
    const s = run(
      dashboard(),
      { type: 'decide', key: 'NETFLIX', decision: 'stake' },
      { type: 'decide', key: 'SPOTIFY', decision: 'keep' },
      { type: 'undo', key: 'NETFLIX' },
    );
    expect(s.decisions).toEqual({ SPOTIFY: 'keep' });
  });
});

describe('purity and reset', () => {
  it('does not modify the previous state', () => {
    const start = run(dashboard(), { type: 'count', key: RENT });
    const snapshot = JSON.stringify({ ...start, counted: [...start.counted] });
    run(start, { type: 'decide', key: RENT, decision: 'stake' }, { type: 'undo', key: RENT }, { type: 'undo', key: RENT });
    expect(JSON.stringify({ ...start, counted: [...start.counted] })).toBe(snapshot);
  });

  it('a new statement starts with no decisions and nothing counted', () => {
    const decided = run(dashboard(), { type: 'count', key: RENT }, { type: 'decide', key: 'NETFLIX', decision: 'stake' });
    const fresh = run(decided, { type: 'statementParsed', result: parseStatement(SAMPLE) });
    expect(fresh.decisions).toEqual({});
    expect([...fresh.counted]).toEqual([]);
  });
});
