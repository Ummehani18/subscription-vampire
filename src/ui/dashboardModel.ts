import { flagDuplicates, isEligible, totals, type Totals } from '../core/savings';
import type { Cadence, Decision, Vampire } from '../core/types';
import { canUndo, isCountedTier, type CardDecision } from './appState';

export type CardAction = CardDecision | 'count';

export interface CardModel {
  vampire: Vampire;
  decision: Decision;
  /** A Subscription, or an Other recurring payment the user counted. */
  counted: boolean;
  /** Shown with the "Possible duplicate" badge (Req 5.4, design: flagDuplicates). */
  duplicate: boolean;
  /** Buttons offered: Keep / Stake / Dismiss once counted, else Count it / Dismiss (Req 5.6). */
  actions: CardAction[];
  canUndo: boolean;
}

export interface DashboardModel {
  totals: Totals;
  /** Eligible staked vampires, the N in "You staked N vampires". */
  stakedCount: number;
  /** Share of the eligible, non-dismissed drain still being paid: yearlyDrain / (yearlyDrain + savedPerYear). */
  meterFill: number;
  subscriptions: CardModel[];
  other: CardModel[];
  dismissed: CardModel[];
}

/**
 * Everything the dashboard shows, from the detected vampires and the user's
 * choices. Totals and duplicates come from savings.ts; vampire order is the
 * detector's (annual drain, highest first).
 */
export function buildDashboard(
  vampires: readonly Vampire[],
  decisions: Readonly<Record<string, Decision>>,
  counted: ReadonlySet<string>,
): DashboardModel {
  const sums = totals(vampires, decisions, counted);
  const duplicateCategories = flagDuplicates(vampires, decisions, counted);

  const cards = vampires.map((vampire): CardModel => {
    const decision = decisions[vampire.key] ?? 'undecided';
    const isCounted = isCountedTier(vampire, counted);
    return {
      vampire,
      decision,
      counted: isCounted,
      duplicate:
        duplicateCategories.includes(vampire.category) && isEligible(vampire, counted) && decision !== 'dismiss',
      actions: isCounted ? ['keep', 'stake', 'dismiss'] : ['count', 'dismiss'],
      canUndo: canUndo(vampire, decisions, counted),
    };
  });

  const paidOrSaved = sums.yearlyDrain + sums.savedPerYear;
  return {
    totals: sums,
    stakedCount: cards.filter((c) => c.decision === 'stake' && isEligible(c.vampire, counted)).length,
    meterFill: paidOrSaved === 0 ? 0 : sums.yearlyDrain / paidOrSaved,
    subscriptions: cards.filter((c) => c.decision !== 'dismiss' && c.vampire.tier === 'subscription'),
    other: cards.filter((c) => c.decision !== 'dismiss' && c.vampire.tier === 'other'),
    dismissed: cards.filter((c) => c.decision === 'dismiss'),
  };
}

export const CADENCE_LABELS: Readonly<Record<Cadence, string>> = {
  weekly: 'Weekly',
  every28days: 'Every 28 days',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' -> '13 Nov 2026', without using the local timezone. */
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''} ${year}`;
}
