import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../../src/core/detectRecurring';
import { parseStatement } from '../../src/core/parseStatement';
import type { Decision, Vampire } from '../../src/core/types';
import { appReducer, initialState } from '../../src/ui/appState';
import BloodMeter from '../../src/ui/components/BloodMeter';
import Dashboard from '../../src/ui/components/Dashboard';
import SavingsBanner from '../../src/ui/components/SavingsBanner';

// Static rendering only: markup, text and accessibility attributes. Clicking and
// keyboard use are covered through the reducer tests and the manual checklist.
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const vampiresOf = (relative: string) => detectRecurring(parseStatement(read(relative)).transactions);
const SAMPLE = vampiresOf('../../data/sample-statement.csv');
const noop = () => undefined;

function renderDashboard(
  vampires: Vampire[],
  decisions: Record<string, Decision> = {},
  counted: ReadonlySet<string> = new Set(),
  skippedRows = 0,
): string {
  return renderToStaticMarkup(
    createElement(Dashboard, { vampires, decisions, counted, skippedRows, onDecide: noop, onCount: noop, onUndo: noop, onExport: noop }),
  );
}

/** The <article> for one merchant. */
function card(html: string, merchant: string): string {
  const articles = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
  return articles.find((a) => a.includes(`>${merchant}</h3>`)) ?? '';
}
const count = (html: string, text: string) => html.split(text).length - 1;

describe('Dashboard with the sample statement (8.2)', () => {
  const html = renderDashboard(SAMPLE);

  it('shows seven Subscription cards and rent under a collapsed "Other recurring payments"', () => {
    expect(html).toContain('Subscriptions (7)');
    const [beforeOther, otherAndAfter] = html.split('<details');
    expect(count(beforeOther ?? '', '<article')).toBe(7);
    expect(html).toMatch(/<details class="[^"]*"><summary[^>]*>Other recurring payments \(1\)<\/summary>/);
    expect(otherAndAfter).toContain('>Landlord Ramesh</h3>');
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it('has no Dismissed section until something is dismissed, then a collapsed one', () => {
    expect(html).not.toContain('Dismissed (');
    const dismissed = renderDashboard(SAMPLE, { NETFLIX: 'dismiss' });
    expect(dismissed).toMatch(/<details[^>]*><summary[^>]*>Dismissed \(1\)<\/summary>/);
    expect(dismissed).toContain('Subscriptions (6)');
  });

  it('Spotify shows ₹139, its cadence and a text "Price hike" badge', () => {
    const spotify = card(html, 'Spotify');
    expect(spotify).toContain('₹139.00');
    expect(spotify).toContain('Monthly');
    expect(spotify).toContain('Price hike: ₹119.00 → ₹139.00');
    expect(spotify).toContain('Next expected');
    expect(spotify).toContain('13 Nov 2026');
  });

  it('YouTube Premium and Spotify show a text "Possible duplicate" badge, and no other card does', () => {
    expect(card(html, 'Spotify')).toContain('Possible duplicate');
    expect(card(html, 'YouTube Premium')).toContain('Possible duplicate');
    expect(count(html, 'Possible duplicate')).toBe(2);
  });

  it('Jio shows the every-28-days cadence', () => {
    expect(card(html, 'Jio')).toContain('Every 28 days');
  });

  it('counted cards have Keep / Stake it / Dismiss buttons, not pressed, and no Undo yet', () => {
    const netflix = card(html, 'Netflix');
    for (const label of ['Keep', 'Stake it', 'Dismiss']) {
      expect(netflix).toMatch(new RegExp(`<button type="button" aria-pressed="false"[^>]*>${label}</button>`));
    }
    expect(netflix).not.toContain('>Count it<');
    expect(netflix).not.toContain('>Undo<');
    expect(netflix).toContain('role="group" aria-label="Decision for Netflix"');
  });

  it('the uncounted rent card has only Count it and Dismiss', () => {
    const rent = card(html, 'Landlord Ramesh');
    expect(rent).toContain('>Count it</button>');
    expect(rent).toContain('>Dismiss</button>');
    expect(rent).not.toContain('>Keep</button>');
    expect(rent).not.toContain('>Stake it</button>');
  });

  it('shows the Blood Meter numbers, the to-review count and "Saved per year"', () => {
    expect(html).toContain('₹54,251.00');
    expect(html).toContain('₹4,520.92');
    expect(html).toContain('7 vampires are feeding on you and waiting for review.');
    expect(html).toContain('Saved per year: <strong class="text-garlic">₹0.00</strong>');
    expect(html).not.toContain('You staked');
  });

  it('every icon is hidden from screen readers except the Blood Meter, which has a label', () => {
    for (const svg of html.match(/<svg[^>]*>/g) ?? []) {
      if (svg.includes('role="img"')) expect(svg).toMatch(/aria-label="Blood Meter 100% full: ₹54,251.00 a year/);
      else expect(svg).toContain('aria-hidden="true"');
    }
  });
});

describe('Dashboard after decisions (8.3)', () => {
  it('a staked card shows a "Staked" badge, a pressed Stake button and Undo; the banner and meter update', () => {
    const html = renderDashboard(SAMPLE, { NETFLIX: 'stake' });
    const netflix = card(html, 'Netflix');
    expect(netflix).toContain('Staked');
    expect(netflix).toMatch(/aria-pressed="true"[^>]*>Stake it<\/button>/);
    expect(netflix).toContain('>Undo</button>');
    expect(html).toContain('You staked 1 vampire and saved ₹7,788.00 a year.');
    expect(html).toContain('₹46,463.00'); // 54,251 - 7,788
    expect(html).toContain('6 vampires are feeding on you');
    expect(html).toMatch(/aria-label="Blood Meter 86% full/);
  });

  it('Keep shows a "Kept" badge and keeps the drain', () => {
    const html = renderDashboard(SAMPLE, { NETFLIX: 'keep' });
    expect(card(html, 'Netflix')).toContain('Kept');
    expect(html).toContain('₹54,251.00');
    expect(html).toContain('6 vampires are feeding on you');
  });

  it('a counted rent card has Keep / Stake it / Dismiss / Undo, and the meter includes it', () => {
    const html = renderDashboard(SAMPLE, {}, new Set(['LANDLORD RAMESH']));
    const rent = card(html, 'Landlord Ramesh');
    for (const label of ['Keep', 'Stake it', 'Dismiss', 'Undo']) expect(rent).toContain(`>${label}</button>`);
    expect(html).toContain('₹2,70,251.00'); // 54,251 + 2,16,000
    expect(html).toContain('8 vampires are feeding on you');
  });

  it('pluralises the banner and says when everything is reviewed', () => {
    const allKept = Object.fromEntries(SAMPLE.map((v) => [v.key, 'keep' as const]));
    expect(renderDashboard(SAMPLE, allKept)).toContain('Every vampire has been reviewed.');
    const banner = renderToStaticMarkup(createElement(SavingsBanner, { stakedCount: 2, savedPerYear: 945600 }));
    expect(banner).toContain('You staked 2 vampires and saved ₹9,456.00 a year.');
  });
});

describe('other badges (8.2)', () => {
  it('a price drop shows a text "Price drop" badge (SBI fixture, JioHotstar)', () => {
    const html = renderDashboard(vampiresOf('../fixtures/sbi-style.csv'));
    expect(card(html, 'JioHotstar')).toContain('Price drop: ₹299.00 → ₹149.00');
  });

  it('a possibly cancelled vampire shows a text "Possibly cancelled" badge (ICICI fixture, Sony LIV)', () => {
    const html = renderDashboard(vampiresOf('../fixtures/icici-style.csv'));
    expect(card(html, 'Sony LIV')).toContain('Possibly cancelled');
    expect(card(html, 'Spotify')).not.toContain('Possibly cancelled');
  });
});

describe('EmptyState (8.4)', () => {
  it('shows "No vampires found" when nothing was detected, with no Blood Meter', () => {
    const html = renderDashboard([]);
    expect(html).toContain('No vampires found');
    expect(html).not.toContain('Blood Meter');
  });

  it('a statement with no recurring charges reaches the empty state', () => {
    const csv = ['Date,Narration,Debit,Credit', '05/05/26,UPI-SWIGGY-1@ybl,412.00,', '19/06/26,UPI-UBER-2@ybl,230.00,'].join('\n');
    const state = appReducer(initialState, { type: 'statementParsed', result: parseStatement(csv) });
    expect(state.stage).toBe('dashboard');
    expect(state.vampires).toEqual([]);
    expect(renderDashboard(state.vampires)).toContain('No vampires found');
  });

  it('still shows the skipped-rows notice', () => {
    expect(renderDashboard([], {}, new Set(), 2)).toContain('2 rows skipped');
  });
});

describe('BloodMeter (8.1)', () => {
  it('has a text alternative and visible yearly and monthly figures', () => {
    const html = renderToStaticMarkup(createElement(BloodMeter, { yearlyDrain: 5425100, monthlyDrain: 452092, fill: 1 }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Blood Meter 100% full: ₹54,251.00 a year is still being drained."');
    expect(html).toContain('₹54,251.00');
    expect(html).toContain('a year');
    expect(html).toContain('₹4,520.92');
    expect(html).toContain('a month');
  });

  it('clamps the fill to 0-100%', () => {
    expect(renderToStaticMarkup(createElement(BloodMeter, { yearlyDrain: 0, monthlyDrain: 0, fill: -1 }))).toContain('0% full');
    expect(renderToStaticMarkup(createElement(BloodMeter, { yearlyDrain: 0, monthlyDrain: 0, fill: 2 }))).toContain('100% full');
  });

  it('animates through a CSS class that the reduced-motion rule switches off', () => {
    const html = renderToStaticMarkup(createElement(BloodMeter, { yearlyDrain: 1, monthlyDrain: 0, fill: 0.5 }));
    expect(html).toContain('class="blood-meter-fill"');
    const css = read('../../src/index.css');
    expect(css).toMatch(/\.blood-meter-fill\s*{[^}]*animation:[^}]*transition:/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*{([\s\S]*?)\n}/.exec(css)?.[1] ?? '';
    expect(reduced).toContain('animation-duration: 0.01ms !important');
    expect(reduced).toContain('transition-duration: 0.01ms !important');
  });
});
