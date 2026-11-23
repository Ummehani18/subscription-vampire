import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../../src/core/detectRecurring';
import { parseStatement } from '../../src/core/parseStatement';
import { CADENCE_LABELS, buildDashboard, formatShortDate } from '../../src/ui/dashboardModel';

const load = (relative: string) =>
  detectRecurring(parseStatement(readFileSync(new URL(relative, import.meta.url), 'utf8')).transactions);
const SAMPLE = load('../../data/sample-statement.csv');
const NONE = new Set<string>();
const keys = (cards: { vampire: { key: string } }[]) => cards.map((c) => c.vampire.key);

describe('buildDashboard: sections (Req 5.2, 5.6)', () => {
  const model = buildDashboard(SAMPLE, {}, NONE);

  it('lists the seven Subscriptions in annual-drain order, rent under Other, nothing dismissed', () => {
    expect(keys(model.subscriptions)).toEqual(['CHATGPT', 'CULT.FIT', 'NETFLIX', 'JIO', 'SPOTIFY', 'GOOGLE ONE', 'YOUTUBE PREMIUM']);
    expect(keys(model.other)).toEqual(['LANDLORD RAMESH']);
    expect(model.dismissed).toEqual([]);
  });

  it('moves dismissed vampires of either tier to Dismissed', () => {
    const m = buildDashboard(SAMPLE, { NETFLIX: 'dismiss', 'LANDLORD RAMESH': 'dismiss' }, NONE);
    expect(keys(m.dismissed)).toEqual(['LANDLORD RAMESH', 'NETFLIX']);
    expect(keys(m.subscriptions)).not.toContain('NETFLIX');
    expect(m.other).toEqual([]);
  });

  it('keeps staked and kept cards in their section', () => {
    const m = buildDashboard(SAMPLE, { NETFLIX: 'stake', SPOTIFY: 'keep' }, NONE);
    expect(keys(m.subscriptions)).toContain('NETFLIX');
    expect(keys(m.subscriptions)).toContain('SPOTIFY');
  });
});

describe('buildDashboard: card actions', () => {
  it('counted cards offer Keep / Stake / Dismiss; uncounted Other cards offer Count it / Dismiss', () => {
    const model = buildDashboard(SAMPLE, {}, NONE);
    for (const card of model.subscriptions) expect(card.actions).toEqual(['keep', 'stake', 'dismiss']);
    expect(model.other[0]?.actions).toEqual(['count', 'dismiss']);
    expect(model.other[0]?.counted).toBe(false);
    const counted = buildDashboard(SAMPLE, {}, new Set(['LANDLORD RAMESH']));
    expect(counted.other[0]?.actions).toEqual(['keep', 'stake', 'dismiss']);
  });

  it('offers Undo only when there is something to undo', () => {
    expect(buildDashboard(SAMPLE, {}, NONE).subscriptions.every((c) => !c.canUndo)).toBe(true);
    expect(buildDashboard(SAMPLE, { NETFLIX: 'keep' }, NONE).subscriptions.find((c) => c.vampire.key === 'NETFLIX')?.canUndo).toBe(true);
    expect(buildDashboard(SAMPLE, {}, new Set(['LANDLORD RAMESH'])).other[0]?.canUndo).toBe(true);
  });
});

describe('buildDashboard: duplicate badge (Req 5.4 as clarified)', () => {
  const duplicates = (decisions = {}, counted: ReadonlySet<string> = NONE) =>
    [...buildDashboard(SAMPLE, decisions, counted).subscriptions, ...buildDashboard(SAMPLE, decisions, counted).dismissed]
      .filter((c) => c.duplicate)
      .map((c) => c.vampire.key)
      .sort();

  it('flags Spotify and YouTube Premium (music), and nothing else', () => {
    expect(duplicates()).toEqual(['SPOTIFY', 'YOUTUBE PREMIUM']);
  });

  it('staked vampires keep the flag', () => {
    expect(duplicates({ SPOTIFY: 'stake' })).toEqual(['SPOTIFY', 'YOUTUBE PREMIUM']);
  });

  it('dismissing one clears the flag on both', () => {
    expect(duplicates({ 'YOUTUBE PREMIUM': 'dismiss' })).toEqual([]);
  });

  it('possibly cancelled vampires are not flagged and do not make duplicates', () => {
    const icici = load('../fixtures/icici-style.csv');
    const lapsed = icici.map((v) => (v.key === 'YOUTUBE PREMIUM' ? { ...v, possiblyCancelled: true } : v));
    const model = buildDashboard(lapsed, {}, NONE);
    expect(model.subscriptions.filter((c) => c.duplicate)).toEqual([]);
  });
});

describe('buildDashboard: totals, Blood Meter fill and savings', () => {
  it('uses savings.totals', () => {
    expect(buildDashboard(SAMPLE, {}, NONE).totals).toEqual({
      yearlyDrain: 5425100,
      monthlyDrain: 452092,
      savedPerYear: 0,
      toReview: 7,
    });
  });

  it('the meter is full until something is staked, then drops by the staked share', () => {
    expect(buildDashboard(SAMPLE, {}, NONE).meterFill).toBe(1);
    expect(buildDashboard(SAMPLE, { NETFLIX: 'keep', SPOTIFY: 'dismiss' }, NONE).meterFill).toBe(1);
    const staked = buildDashboard(SAMPLE, { NETFLIX: 'stake' }, NONE);
    expect(staked.meterFill).toBeCloseTo((5425100 - 778800) / 5425100, 10);
  });

  it('the meter is empty when everything is staked or nothing counts', () => {
    const allStaked = Object.fromEntries(SAMPLE.map((v) => [v.key, 'stake' as const]));
    expect(buildDashboard(SAMPLE, allStaked, NONE).meterFill).toBe(0);
    const allDismissed = Object.fromEntries(SAMPLE.map((v) => [v.key, 'dismiss' as const]));
    expect(buildDashboard(SAMPLE, allDismissed, NONE).meterFill).toBe(0);
  });

  it('counts eligible staked vampires for the savings banner', () => {
    expect(buildDashboard(SAMPLE, { NETFLIX: 'stake', SPOTIFY: 'stake' }, NONE).stakedCount).toBe(2);
    // A staked vampire that is possibly cancelled saves nothing, so it is not counted.
    const lapsed = SAMPLE.map((v) => (v.key === 'NETFLIX' ? { ...v, possiblyCancelled: true } : v));
    const m = buildDashboard(lapsed, { NETFLIX: 'stake' }, NONE);
    expect(m.stakedCount).toBe(0);
    expect(m.totals.savedPerYear).toBe(0);
  });
});

describe('formatting helpers', () => {
  it('formatShortDate', () => {
    expect(formatShortDate('2026-11-13')).toBe('13 Nov 2026');
    expect(formatShortDate('2027-01-04')).toBe('4 Jan 2027');
  });

  it('cadence labels', () => {
    expect(CADENCE_LABELS).toEqual({
      weekly: 'Weekly',
      every28days: 'Every 28 days',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
    });
  });
});
