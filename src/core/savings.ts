import type { Decision, Paise, Vampire } from './types';

/**
 * The user's decision per vampire, keyed by `Vampire.key`. A vampire with no
 * entry is 'undecided'. Entries for keys that are not in the vampire list are ignored.
 */
export type Decisions = Readonly<Partial<Record<string, Decision>>>;

/** Keys of Other recurring payments the user has clicked "Count it" on. */
export type CountedKeys = ReadonlySet<string>;

export interface Totals {
  /** `yearlyDrain / 12`, rounded half up. */
  monthlyDrain: Paise;
  /** Annual drain of eligible vampires that are undecided or kept. */
  yearlyDrain: Paise;
  /** Annual drain of eligible vampires that are staked. */
  savedPerYear: Paise;
  /** Number of eligible vampires with no decision yet. */
  toReview: number;
}

/** Categories checked for possible duplicates (Req 5.4), in the order they are reported. */
export const DUPLICATE_CATEGORIES: readonly string[] = ['music', 'ott-video', 'cloud'];

const decisionOf = (vampire: Vampire, decisions: Decisions): Decision => decisions[vampire.key] ?? 'undecided';

/**
 * A vampire counts toward the totals when it is not possibly cancelled and is
 * either a Subscription (always counted) or an Other recurring payment the user
 * has clicked "Count it" on.
 */
export function isEligible(vampire: Vampire, counted: CountedKeys): boolean {
  return !vampire.possiblyCancelled && (vampire.tier === 'subscription' || counted.has(vampire.key));
}

/**
 * Blood Meter and savings totals over eligible vampires only. Undecided and kept
 * vampires are drain, staked vampires are savings, and dismissed vampires count
 * toward neither.
 */
export function totals(vampires: readonly Vampire[], decisions: Decisions, counted: CountedKeys): Totals {
  let yearlyDrain = 0;
  let savedPerYear = 0;
  let toReview = 0;
  for (const vampire of vampires) {
    if (!isEligible(vampire, counted)) continue;
    const decision = decisionOf(vampire, decisions);
    if (decision === 'stake') savedPerYear += vampire.annualDrain;
    else if (decision !== 'dismiss') yearlyDrain += vampire.annualDrain;
    if (decision === 'undecided') toReview += 1;
  }
  // Round half up in integers: floor(y / 12 + 0.5) == floor((y + 6) / 12) for y >= 0.
  const monthlyDrain = Math.floor((yearlyDrain + 6) / 12);
  return { monthlyDrain, yearlyDrain, savedPerYear, toReview };
}

/**
 * Categories (music, ott-video, cloud) that hold two or more eligible,
 * non-dismissed vampires. Staked vampires still count. Returned in
 * `DUPLICATE_CATEGORIES` order.
 */
export function flagDuplicates(vampires: readonly Vampire[], decisions: Decisions, counted: CountedKeys): string[] {
  const perCategory = new Map<string, number>();
  for (const vampire of vampires) {
    if (!isEligible(vampire, counted) || decisionOf(vampire, decisions) === 'dismiss') continue;
    if (!DUPLICATE_CATEGORIES.includes(vampire.category)) continue;
    perCategory.set(vampire.category, (perCategory.get(vampire.category) ?? 0) + 1);
  }
  return DUPLICATE_CATEGORIES.filter((category) => (perCategory.get(category) ?? 0) >= 2);
}
