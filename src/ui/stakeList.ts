import { formatINR } from '../core/amounts';
import { isEligible, totals } from '../core/savings';
import type { Decision, Vampire } from '../core/types';
import { VERIFY_NOTE, guideFor } from '../data/cancelGuides';
import { CADENCE_LABELS, formatShortDate } from './dashboardModel';

export const STAKE_LIST_FILENAME = 'stake-list.md';
export const STAKE_LIST_MIME = 'text/markdown;charset=utf-8';

/** Whether any vampire is staked, so "Export Stake List" is enabled (Req 8.2). */
export function hasStaked(vampires: readonly Vampire[], decisions: Readonly<Record<string, Decision>>): boolean {
  return vampires.some((v) => decisions[v.key] === 'stake');
}

/** Backslash-escapes characters that Markdown would treat as formatting in merchant names. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+!|<>~]/g, '\\$&');
}

/**
 * The Stake List as Markdown (Req 8.1): every staked vampire with its amounts
 * and cancel steps, and the annual savings. Contains no transaction narrations.
 * `exportedOn` is 'YYYY-MM-DD'.
 */
export function buildStakeListMarkdown(
  vampires: readonly Vampire[],
  decisions: Readonly<Record<string, Decision>>,
  counted: ReadonlySet<string>,
  exportedOn: string,
): string {
  const staked = vampires.filter((v) => decisions[v.key] === 'stake');
  const { savedPerYear } = totals(vampires, decisions, counted);
  const lines: string[] = [
    '# Stake List',
    '',
    `Exported from Subscription Vampire on ${formatShortDate(exportedOn)}.`,
    '',
    `You staked ${staked.length} ${staked.length === 1 ? 'vampire' : 'vampires'}. Annual savings: ${formatINR(savedPerYear)}.`,
  ];

  for (const vampire of staked) {
    const guide = guideFor(vampire.merchant);
    lines.push(
      '',
      `## ${escapeMarkdown(vampire.merchant)}`,
      '',
      `- Amount: ${formatINR(vampire.currentAmount)} (${CADENCE_LABELS[vampire.cadence].toLowerCase()})`,
      `- A year: ${formatINR(vampire.annualDrain)}`,
      `- Last charge: ${formatShortDate(vampire.lastChargeDate)}`,
      `- Next expected: ${formatShortDate(vampire.nextExpectedDate)}`,
    );
    if (!isEligible(vampire, counted)) {
      lines.push(
        vampire.possiblyCancelled
          ? '- Possibly cancelled already, so not included in the annual savings.'
          : '- Not counted, so not included in the annual savings.',
      );
    }
    lines.push('', '### How to cancel', '');
    const steps = guide.kind === 'merchant' ? guide.guide.steps : guide.steps;
    steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    if (guide.kind === 'merchant') {
      lines.push('', `Last verified: ${formatShortDate(guide.guide.lastVerified)}.`);
      if (guide.guide.url) lines.push(`Source: ${guide.guide.url}`);
    }
  }

  lines.push('', `_${VERIFY_NOTE}._`, '');
  return lines.join('\n');
}
