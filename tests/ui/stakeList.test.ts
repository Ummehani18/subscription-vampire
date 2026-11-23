import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../../src/core/detectRecurring';
import { parseStatement } from '../../src/core/parseStatement';
import { CANCEL_GUIDES, VERIFY_NOTE, genericGuide } from '../../src/data/cancelGuides';
import { STAKE_LIST_FILENAME, STAKE_LIST_MIME, buildStakeListMarkdown, escapeMarkdown, hasStaked } from '../../src/ui/stakeList';

const text = readFileSync(new URL('../../data/sample-statement.csv', import.meta.url), 'utf8');
const SAMPLE_TXNS = parseStatement(text).transactions;
const SAMPLE = detectRecurring(SAMPLE_TXNS);
const NONE = new Set<string>();

describe('hasStaked (Req 8.2)', () => {
  it('is false with no decisions or no staked vampire', () => {
    expect(hasStaked(SAMPLE, {})).toBe(false);
    expect(hasStaked(SAMPLE, { NETFLIX: 'keep', SPOTIFY: 'dismiss' })).toBe(false);
    expect(hasStaked([], {})).toBe(false);
  });

  it('is true once a vampire is staked', () => {
    expect(hasStaked(SAMPLE, { NETFLIX: 'stake' })).toBe(true);
  });

  it('ignores stake decisions for keys that are not in the list', () => {
    expect(hasStaked(SAMPLE, { NOBODY: 'stake' })).toBe(false);
  });
});

describe('buildStakeListMarkdown (Req 8.1)', () => {
  const md = buildStakeListMarkdown(SAMPLE, { NETFLIX: 'stake', SPOTIFY: 'stake', JIO: 'keep' }, NONE, '2026-11-22');

  it('is a Markdown document with a title, the export date, the count and the annual savings', () => {
    expect(md.startsWith('# Stake List\n')).toBe(true);
    expect(md).toContain('Exported from Subscription Vampire on 22 Nov 2026.');
    expect(md).toContain('You staked 2 vampires. Annual savings: ₹9,456.00.'); // 7,788 + 1,668
  });

  it('lists each staked vampire with its amounts and dates, in dashboard order', () => {
    expect(md.indexOf('## Netflix')).toBeGreaterThan(0);
    expect(md.indexOf('## Spotify')).toBeGreaterThan(md.indexOf('## Netflix'));
    expect(md).toContain('- Amount: ₹649.00 (monthly)');
    expect(md).toContain('- A year: ₹7,788.00');
    expect(md).toContain('- Amount: ₹139.00 (monthly)');
    expect(md).toContain('- A year: ₹1,668.00');
    expect(md).toContain('- Last charge: 5 Oct 2026');
    expect(md).toContain('- Next expected: 5 Nov 2026');
  });

  it('does not list vampires that are not staked', () => {
    expect(md).not.toContain('## Jio');
    expect(md).not.toContain('## ChatGPT');
    expect(md.match(/^## /gm)).toHaveLength(2);
  });

  it('includes the verified cancel steps, last-verified date and source for known merchants', () => {
    CANCEL_GUIDES.Netflix?.steps.forEach((step, i) => expect(md).toContain(`${i + 1}. ${step}`));
    expect(md).toContain('Last verified: 22 Nov 2026.');
    expect(md).toContain(`Source: ${CANCEL_GUIDES.Netflix?.url}`);
  });

  it('ends with the verify note', () => {
    expect(md.trimEnd().endsWith(`_${VERIFY_NOTE}._`)).toBe(true);
  });

  it('uses the generic steps for a merchant without a verified guide', () => {
    const counted = new Set(['LANDLORD RAMESH']);
    const rent = buildStakeListMarkdown(SAMPLE, { 'LANDLORD RAMESH': 'stake' }, counted, '2026-11-22');
    expect(rent).toContain('## Landlord Ramesh');
    genericGuide.steps.forEach((step, i) => expect(rent).toContain(`${i + 1}. ${step}`));
    expect(rent).not.toContain('Last verified');
    expect(rent).toContain('Annual savings: ₹2,16,000.00.');
  });

  it('marks a staked vampire that does not count toward the savings', () => {
    const lapsed = SAMPLE.map((v) => (v.key === 'NETFLIX' ? { ...v, possiblyCancelled: true } : v));
    const out = buildStakeListMarkdown(lapsed, { NETFLIX: 'stake' }, NONE, '2026-11-22');
    expect(out).toContain('## Netflix');
    expect(out).toContain('Possibly cancelled already, so not included in the annual savings.');
    expect(out).toContain('Annual savings: ₹0.00.');
  });

  it('uses the singular for one vampire', () => {
    expect(buildStakeListMarkdown(SAMPLE, { NETFLIX: 'stake' }, NONE, '2026-11-22')).toContain('You staked 1 vampire.');
  });

  it('contains no transaction narrations or reference numbers', () => {
    for (const t of SAMPLE_TXNS) expect(md).not.toContain(t.narration);
    expect(md).not.toMatch(/\d{7,}/);
  });

  it('escapes Markdown characters in merchant names', () => {
    const odd = [{ ...SAMPLE[0]!, merchant: 'A*B_[C]#', key: 'ODD' }];
    const out = buildStakeListMarkdown(odd, { ODD: 'stake' }, NONE, '2026-11-22');
    expect(out).toContain('## A\\*B\\_\\[C\\]\\#');
    expect(escapeMarkdown('Cult.fit')).toBe('Cult.fit');
  });

  it('uses the stake-list.md file name and a Markdown MIME type', () => {
    expect(STAKE_LIST_FILENAME).toBe('stake-list.md');
    expect(STAKE_LIST_MIME).toBe('text/markdown;charset=utf-8');
  });
});
